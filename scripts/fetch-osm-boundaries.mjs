/**
 * fetch-osm-boundaries.mjs
 *
 * Fetches beach polygon boundaries from OpenStreetMap (Overpass API)
 * and saves them to the Supabase beaches table.
 *
 * Usage:
 *   node scripts/fetch-osm-boundaries.mjs
 *
 * Requires .env with EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env manually (no dotenv dependency needed)
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, '..', '.env');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  console.error('   Add: SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Overpass API query — finds natural=beach ways/relations near a lat/lng
async function fetchOsmBoundary(name, lat, lng, radiusMetres = 1000) {
  const query = `
    [out:json][timeout:25];
    (
      way["natural"="beach"]["name"~"${name}",i](around:${radiusMetres},${lat},${lng});
      relation["natural"="beach"]["name"~"${name}",i](around:${radiusMetres},${lat},${lng});
    );
    out geom;
  `;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query,
    headers: { 'Content-Type': 'text/plain' },
  });

  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);
  const json = await res.json();
  return json.elements ?? [];
}

// Convert OSM way geometry to a GeoJSON-style coordinate array [[lng, lat], ...]
function osmWayToCoordinates(element) {
  if (element.type === 'way' && element.geometry) {
    return element.geometry.map(pt => [pt.lon, pt.lat]);
  }
  if (element.type === 'relation' && element.members) {
    // Use the outer member way
    const outer = element.members.find(m => m.role === 'outer' && m.geometry);
    if (outer) return outer.geometry.map(pt => [pt.lon, pt.lat]);
  }
  return null;
}

// Pick the best matching element (prefer ways over relations, closest to beach centre)
function pickBestElement(elements, lat, lng) {
  if (!elements.length) return null;

  const scored = elements.map(el => {
    let coords = osmWayToCoordinates(el);
    if (!coords || coords.length < 3) return null;

    // Compute centroid
    const centLng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
    const centLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;

    // Distance from expected centre
    const dist = Math.sqrt((centLat - lat) ** 2 + (centLng - lng) ** 2);

    return { el, coords, dist };
  }).filter(Boolean);

  if (!scored.length) return null;
  scored.sort((a, b) => a.dist - b.dist);
  return scored[0];
}

async function main() {
  // Fetch all beaches that don't have a boundary yet
  const { data: beaches, error } = await supabase
    .from('beaches')
    .select('id, name, lat, lng, osm_id')
    .is('boundary', null)
    .order('name');

  if (error) { console.error('❌ Supabase error:', error.message); process.exit(1); }
  if (!beaches.length) { console.log('✅ All beaches already have boundaries.'); return; }

  console.log(`\n🏖️  Fetching OSM boundaries for ${beaches.length} beach(es)...\n`);

  for (const beach of beaches) {
    process.stdout.write(`  ${beach.name}... `);

    try {
      const elements = await fetchOsmBoundary(beach.name, beach.lat, beach.lng);
      const best = pickBestElement(elements, beach.lat, beach.lng);

      if (!best) {
        console.log('⚠️  No OSM polygon found, skipping.');
        continue;
      }

      // Store as GeoJSON Polygon
      const boundary = {
        type: 'Polygon',
        coordinates: [best.coords],
      };

      const { error: updateErr } = await supabase
        .from('beaches')
        .update({
          boundary,
          osm_id: best.el.id ? String(best.el.id) : undefined,
        })
        .eq('id', beach.id);

      if (updateErr) {
        console.log(`❌ Update failed: ${updateErr.message}`);
      } else {
        console.log(`✅ Saved (${best.coords.length} points)`);
      }

      // Rate limit — be polite to Overpass
      await new Promise(r => setTimeout(r, 1200));
    } catch (e) {
      console.log(`❌ Error: ${e.message}`);
    }
  }

  console.log('\n✅ Done!\n');
}

main();
