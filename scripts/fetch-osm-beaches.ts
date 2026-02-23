/**
 * fetch-osm-beaches.ts
 *
 * One-off script: pulls Australian beach data from the OpenStreetMap Overpass API,
 * cleans it, and writes a CSV file ready for import into Supabase.
 *
 * Usage:
 *   npx ts-node scripts/fetch-osm-beaches.ts
 *
 * Output:
 *   scripts/output/beaches.csv
 *   scripts/output/beaches.json  (raw, for inspection)
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Config ────────────────────────────────────────────────────────────────────

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OUTPUT_DIR = path.join(__dirname, 'output');

// Australian bounding box (south, west, north, east)
const AUS_BBOX = '-43.6345972634,-113.338953078,-10.6681857235,153.569469029';

// Overpass QL query — fetch named beaches inside Australia
const QUERY = `
[out:json][timeout:120];
(
  node["natural"="beach"]["name"](${AUS_BBOX});
  way["natural"="beach"]["name"](${AUS_BBOX});
  relation["natural"="beach"]["name"](${AUS_BBOX});
);
out center tags;
`.trim();

// ── Helpers ───────────────────────────────────────────────────────────────────

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Record<string, string>;
}

interface Beach {
  osm_id: string;
  name: string;
  lat: number;
  lng: number;
  state: string;
  region: string;
  beach_type: string;
  is_dog_friendly: boolean;
  is_patrolled: boolean;
  is_wheelchair_accessible: boolean;
  surf_rating: number;
  is_hub_location: boolean;
  facilities: string; // JSON string for CSV
}

const STATE_MAP: Record<string, string> = {
  'New South Wales': 'NSW', nsw: 'NSW',
  'Victoria': 'VIC', vic: 'VIC',
  'Queensland': 'QLD', qld: 'QLD',
  'South Australia': 'SA', sa: 'SA',
  'Western Australia': 'WA', wa: 'WA',
  'Tasmania': 'TAS', tas: 'TAS',
  'Northern Territory': 'NT', nt: 'NT',
  'Australian Capital Territory': 'ACT', act: 'ACT',
};

function inferState(tags: Record<string, string>): string {
  const candidates = [
    tags['addr:state'],
    tags['is_in:state'],
    tags['is_in'],
  ];
  for (const c of candidates) {
    if (!c) continue;
    const upper = c.trim().toUpperCase();
    // Check abbreviation directly
    if (['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'].includes(upper)) return upper;
    // Check full name
    for (const [full, abbr] of Object.entries(STATE_MAP)) {
      if (c.toLowerCase().includes(full.toLowerCase())) return abbr;
    }
  }
  return 'Unknown';
}

function inferBeachType(tags: Record<string, string>): string {
  const name = (tags['name'] ?? '').toLowerCase();
  const surface = (tags['surface'] ?? '').toLowerCase();
  if (tags['tidal'] === 'yes' || name.includes('estuary') || name.includes('inlet')) return 'estuary';
  if (name.includes('rock') || surface === 'rock') return 'rock_pool';
  if (name.includes('bay') || name.includes('cove') || name.includes('harbour')) return 'calm_bay';
  if (name.includes('lake') || name.includes('lagoon')) return 'lake';
  if (tags['sport'] === 'surfing' || tags['surf'] === 'yes') return 'surf_beach';
  return 'surf_beach'; // default for Australian coastline
}

function inferSurfRating(tags: Record<string, string>): number {
  // OSM rarely has surf quality; use heuristic from name
  const name = (tags['name'] ?? '').toLowerCase();
  if (name.includes('surf') || tags['sport'] === 'surfing') return 4;
  return 2;
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCSVRow(b: Beach): string {
  return [
    b.osm_id, b.name, b.lat, b.lng, b.state, b.region,
    b.beach_type, b.is_dog_friendly, b.is_patrolled,
    b.is_wheelchair_accessible, b.surf_rating, b.is_hub_location,
    csvEscape(b.facilities),
  ].join(',');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching beaches from Overpass API...');

  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(QUERY)}`,
  });

  if (!response.ok) {
    console.error('Overpass API error:', response.status, await response.text());
    process.exit(1);
  }

  const json = await response.json() as { elements: OsmElement[] };
  console.log(`Received ${json.elements.length} raw elements`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'beaches.json'), JSON.stringify(json, null, 2));
  console.log('Raw data saved to scripts/output/beaches.json');

  const beaches: Beach[] = [];
  const seen = new Set<string>(); // deduplicate by name+lat+lng

  for (const el of json.elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!lat || !lon) continue;

    const name = el.tags['name']?.trim();
    if (!name) continue;

    // Skip very short names (likely incomplete data)
    if (name.length < 3) continue;

    const dedupeKey = `${name.toLowerCase()}|${lat.toFixed(3)}|${lon.toFixed(3)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const tags = el.tags;
    const state = inferState(tags);

    const facilities = {
      parking: tags['amenity'] === 'parking' || tags['parking'] === 'yes',
      toilets: tags['toilets'] === 'yes' || tags['amenity'] === 'toilets',
      showers: tags['shower'] === 'yes',
      cafe: tags['amenity'] === 'cafe' || tags['amenity'] === 'restaurant',
      lifeguard: tags['lifeguard'] === 'yes' || tags['safety:lifeguard'] === 'yes',
    };

    beaches.push({
      osm_id: `${el.type}/${el.id}`,
      name,
      lat,
      lng: lon,
      state,
      region: tags['addr:suburb'] ?? tags['addr:city'] ?? tags['addr:county'] ?? '',
      beach_type: inferBeachType(tags),
      is_dog_friendly: tags['dog'] === 'yes' || tags['dogs'] === 'yes',
      is_patrolled: tags['lifeguard'] === 'yes' || tags['safety:lifeguard'] === 'yes',
      is_wheelchair_accessible: tags['wheelchair'] === 'yes',
      surf_rating: inferSurfRating(tags),
      // Mark as hub if it's a state capital coast area (to minimise Stormglass calls)
      is_hub_location: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Hobart', 'Darwin'].some(
        (city) => name.includes(city) || (tags['addr:city'] ?? '').includes(city)
      ),
      facilities: JSON.stringify(facilities),
    });
  }

  console.log(`Cleaned to ${beaches.length} unique beaches`);

  const header = [
    'osm_id', 'name', 'lat', 'lng', 'state', 'region',
    'beach_type', 'is_dog_friendly', 'is_patrolled',
    'is_wheelchair_accessible', 'surf_rating', 'is_hub_location', 'facilities',
  ].join(',');

  const rows = beaches.map(toCSVRow);
  const csv = [header, ...rows].join('\n');

  const csvPath = path.join(OUTPUT_DIR, 'beaches.csv');
  fs.writeFileSync(csvPath, csv);
  console.log(`CSV written to ${csvPath}`);
  console.log('\nNext step: run scripts/seed-beaches.ts to import into Supabase.');
}

main().catch((e) => { console.error(e); process.exit(1); });
