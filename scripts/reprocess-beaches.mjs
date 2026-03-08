/**
 * reprocess-beaches.mjs
 * Re-processes the already-downloaded scripts/output/beaches.json
 * and re-generates beaches.csv with coordinate-based state inference.
 * Run with: node scripts/reprocess-beaches.mjs
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, 'output');
const JSON_PATH = path.join(OUTPUT_DIR, 'beaches.json');
const CSV_PATH = path.join(OUTPUT_DIR, 'beaches.csv');

// Approximate bounding boxes for each Australian state/territory [minLat, maxLat, minLng, maxLng]
// More specific states listed first to handle border ambiguity
const STATE_BOUNDS = [
  { state: 'TAS', minLat: -43.65, maxLat: -39.45, minLng: 143.80, maxLng: 148.50 },
  { state: 'ACT', minLat: -35.92, maxLat: -35.10, minLng: 148.76, maxLng: 149.40 },
  { state: 'VIC', minLat: -39.20, maxLat: -33.98, minLng: 140.96, maxLng: 149.98 },
  { state: 'NSW', minLat: -37.55, maxLat: -28.15, minLng: 140.99, maxLng: 153.64 },
  { state: 'SA',  minLat: -38.10, maxLat: -25.99, minLng: 129.00, maxLng: 141.00 },
  { state: 'QLD', minLat: -29.18, maxLat: -10.68, minLng: 137.99, maxLng: 153.55 },
  { state: 'NT',  minLat: -26.00, maxLat: -10.96, minLng: 129.00, maxLng: 138.00 },
  { state: 'WA',  minLat: -35.13, maxLat: -13.69, minLng: 112.92, maxLng: 129.00 },
];

const STATE_MAP = {
  'New South Wales': 'NSW', 'Victoria': 'VIC', 'Queensland': 'QLD',
  'South Australia': 'SA', 'Western Australia': 'WA', 'Tasmania': 'TAS',
  'Northern Territory': 'NT', 'Australian Capital Territory': 'ACT',
};

function inferStateFromCoords(lat, lng) {
  for (const b of STATE_BOUNDS) {
    if (lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng) {
      return b.state;
    }
  }
  return 'Unknown';
}

function inferState(tags, lat, lng) {
  const candidates = [tags['addr:state'], tags['is_in:state'], tags['is_in']];
  for (const c of candidates) {
    if (!c) continue;
    const upper = c.trim().toUpperCase();
    if (['NSW','VIC','QLD','SA','WA','TAS','NT','ACT'].includes(upper)) return upper;
    for (const [full, abbr] of Object.entries(STATE_MAP)) {
      if (c.toLowerCase().includes(full.toLowerCase())) return abbr;
    }
  }
  return inferStateFromCoords(lat, lng);
}

function inferBeachType(tags) {
  const name = (tags['name'] ?? '').toLowerCase();
  const surface = (tags['surface'] ?? '').toLowerCase();
  if (tags['tidal'] === 'yes' || name.includes('estuary') || name.includes('inlet')) return 'estuary';
  if (name.includes('rock') || surface === 'rock') return 'rock_pool';
  if (name.includes('bay') || name.includes('cove') || name.includes('harbour')) return 'calm_bay';
  if (name.includes('lake') || name.includes('lagoon')) return 'lake';
  if (tags['sport'] === 'surfing' || tags['surf'] === 'yes') return 'surf_beach';
  return 'surf_beach';
}

function inferSurfRating(tags) {
  const name = (tags['name'] ?? '').toLowerCase();
  if (name.includes('surf') || tags['sport'] === 'surfing') return 4;
  return 2;
}

function toSlug(name, state, osmId) {
  const base = name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
  const stateStr = state.toLowerCase();
  const suffix = osmId.replace('/', '-');
  return `${base}-${stateStr}-${suffix}`;
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

if (!fs.existsSync(JSON_PATH)) {
  console.error('beaches.json not found. Run fetch-osm-beaches.ts first.');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
console.log(`Loaded ${raw.elements.length} raw elements from beaches.json`);

const beaches = [];
const seen = new Set();
let unknownState = 0;

for (const el of raw.elements) {
  let lat = el.lat ?? el.center?.lat;
  let lon = el.lon ?? el.center?.lon;
  if ((!lat || !lon) && el.geometry && el.geometry.length > 0) {
    lat = el.geometry.reduce((s, p) => s + p.lat, 0) / el.geometry.length;
    lon = el.geometry.reduce((s, p) => s + p.lon, 0) / el.geometry.length;
  }
  if (!lat || !lon) continue;

  const name = el.tags['name']?.trim();
  if (!name || name.length < 3) continue;

  const dedupeKey = `${name.toLowerCase()}|${lat.toFixed(3)}|${lon.toFixed(3)}`;
  if (seen.has(dedupeKey)) continue;
  seen.add(dedupeKey);

  const tags = el.tags;
  const osmId = `${el.type}/${el.id}`;
  const state = inferState(tags, lat, lon);

  if (state === 'Unknown') { unknownState++; continue; }

  const facilities = {
    parking:   tags['amenity'] === 'parking' || tags['parking'] === 'yes',
    toilets:   tags['toilets'] === 'yes' || tags['amenity'] === 'toilets',
    showers:   tags['shower'] === 'yes',
    cafe:      tags['amenity'] === 'cafe' || tags['amenity'] === 'restaurant',
    lifeguard: tags['lifeguard'] === 'yes' || tags['safety:lifeguard'] === 'yes',
  };

  // Extract polygon boundary if geometry is present (only when fetched with `out center geom tags`)
  let boundary = '';
  if (el.type === 'way' && el.geometry && el.geometry.length >= 3) {
    const ring = el.geometry.map(pt => [pt.lon, pt.lat]);
    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
      ring.push(ring[0]);
    }
    boundary = JSON.stringify({ type: 'Polygon', coordinates: [ring] });
  }

  beaches.push({
    osm_id:                  osmId,
    name,
    slug:                    toSlug(name, state, osmId),
    lat,
    lng:                     lon,
    state,
    region:                  tags['addr:suburb'] ?? tags['addr:city'] ?? tags['addr:county'] ?? '',
    beach_type:              inferBeachType(tags),
    is_dog_friendly:         tags['dog'] === 'yes' || tags['dogs'] === 'yes',
    is_patrolled:            tags['lifeguard'] === 'yes' || tags['safety:lifeguard'] === 'yes',
    is_wheelchair_accessible: tags['wheelchair'] === 'yes',
    surf_rating:             inferSurfRating(tags),
    is_hub_location:         ['Sydney','Melbourne','Brisbane','Perth','Adelaide','Hobart','Darwin'].some(
                               city => name.includes(city) || (tags['addr:city'] ?? '').includes(city)
                             ),
    facilities:              JSON.stringify(facilities),
    boundary,
  });
}

console.log(`Processed ${beaches.length} beaches with known states (${unknownState} skipped — no state match)`);

// State breakdown
const stateCounts = {};
for (const b of beaches) { stateCounts[b.state] = (stateCounts[b.state] ?? 0) + 1; }
console.log('Breakdown:', stateCounts);

const header = ['osm_id','name','slug','lat','lng','state','region','beach_type',
                'is_dog_friendly','is_patrolled','is_wheelchair_accessible',
                'surf_rating','is_hub_location','facilities','boundary'].join(',');

const rows = beaches.map(b => [
  csvEscape(b.osm_id), csvEscape(b.name), csvEscape(b.slug),
  b.lat, b.lng, b.state, csvEscape(b.region),
  b.beach_type, b.is_dog_friendly, b.is_patrolled,
  b.is_wheelchair_accessible, b.surf_rating, b.is_hub_location,
  csvEscape(b.facilities),
  b.boundary ? csvEscape(b.boundary) : '',
].join(','));

fs.writeFileSync(CSV_PATH, [header, ...rows].join('\n'));
console.log(`CSV written to ${CSV_PATH}`);
