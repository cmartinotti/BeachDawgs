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
const AUS_BBOX = '-43.6345972634,113.338953078,-10.6681857235,153.569469029';

// Overpass QL query — fetch named beaches inside Australia
// `out center geom tags` returns both the centroid (for nodes/fallback) and
// full polygon geometry (for ways) so we can populate the boundary column.
const QUERY = `
[out:json][timeout:180];
(
  node["natural"="beach"]["name"](${AUS_BBOX});
  way["natural"="beach"]["name"](${AUS_BBOX});
  relation["natural"="beach"]["name"](${AUS_BBOX});
);
out center geom tags;
`.trim();

// ── Helpers ───────────────────────────────────────────────────────────────────

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: { lat: number; lon: number }[]; // present for ways when using `out geom`
  tags: Record<string, string>;
}

interface Beach {
  osm_id: string;
  name: string;
  slug: string;
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
  boundary: string;  // GeoJSON Polygon JSON string, or empty string
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

// Approximate bounding boxes for each Australian state/territory
// Format: [minLat, maxLat, minLng, maxLng]
// These overlap in some border areas — order matters (more specific first)
const STATE_BOUNDS: Array<{ state: string; minLat: number; maxLat: number; minLng: number; maxLng: number }> = [
  { state: 'TAS', minLat: -43.65, maxLat: -39.45, minLng: 143.80, maxLng: 148.50 },
  { state: 'ACT', minLat: -35.92, maxLat: -35.10, minLng: 148.76, maxLng: 149.40 },
  { state: 'VIC', minLat: -39.20, maxLat: -33.98, minLng: 140.96, maxLng: 149.98 },
  { state: 'NSW', minLat: -37.55, maxLat: -28.15, minLng: 140.99, maxLng: 153.64 },
  { state: 'SA',  minLat: -38.10, maxLat: -25.99, minLng: 129.00, maxLng: 141.00 },
  { state: 'QLD', minLat: -29.18, maxLat: -10.68, minLng: 137.99, maxLng: 153.55 },
  { state: 'NT',  minLat: -26.00, maxLat: -10.96, minLng: 129.00, maxLng: 138.00 },
  { state: 'WA',  minLat: -35.13, maxLat: -13.69, minLng: 112.92, maxLng: 129.00 },
];

function inferStateFromCoords(lat: number, lng: number): string {
  for (const b of STATE_BOUNDS) {
    if (lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng) {
      return b.state;
    }
  }
  return 'Unknown';
}

function inferState(tags: Record<string, string>, lat: number, lng: number): string {
  // Try OSM tags first
  const candidates = [
    tags['addr:state'],
    tags['is_in:state'],
    tags['is_in'],
  ];
  for (const c of candidates) {
    if (!c) continue;
    const upper = c.trim().toUpperCase();
    if (['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'].includes(upper)) return upper;
    for (const [full, abbr] of Object.entries(STATE_MAP)) {
      if (c.toLowerCase().includes(full.toLowerCase())) return abbr;
    }
  }
  // Fall back to coordinate-based lookup
  return inferStateFromCoords(lat, lng);
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

function toSlug(name: string, state: string, osmId: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  const stateStr = state.toLowerCase();
  // Append OSM id suffix to guarantee uniqueness
  const suffix = osmId.replace('/', '-');
  return `${base}-${stateStr}-${suffix}`;
}

function toCSVRow(b: Beach): string {
  return [
    b.osm_id, csvEscape(b.name), csvEscape(b.slug), b.lat, b.lng, b.state, csvEscape(b.region),
    b.beach_type, b.is_dog_friendly, b.is_patrolled,
    b.is_wheelchair_accessible, b.surf_rating, b.is_hub_location,
    csvEscape(b.facilities),
    b.boundary ? csvEscape(b.boundary) : '',
  ].join(',');
}

function extractBoundary(el: OsmElement): string {
  // Only ways have usable linear geometry from `out geom`; relations are complex multipolygons.
  if (el.type !== 'way' || !el.geometry || el.geometry.length < 3) return '';
  // Build GeoJSON Polygon ring in [lng, lat] order
  const ring: [number, number][] = el.geometry.map((pt) => [pt.lon, pt.lat]);
  // Close the ring if not already closed
  if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
    ring.push(ring[0]);
  }
  return JSON.stringify({ type: 'Polygon', coordinates: [ring] });
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
    // Node: has lat/lon directly. Way/Relation: may have center OR geometry (compute centroid).
    let lat = el.lat ?? el.center?.lat;
    let lon = el.lon ?? el.center?.lon;
    if ((!lat || !lon) && el.geometry && el.geometry.length > 0) {
      lat = el.geometry.reduce((s, p) => s + p.lat, 0) / el.geometry.length;
      lon = el.geometry.reduce((s, p) => s + p.lon, 0) / el.geometry.length;
    }
    if (!lat || !lon) continue;

    const name = el.tags['name']?.trim();
    if (!name) continue;

    // Skip very short names (likely incomplete data)
    if (name.length < 3) continue;

    const dedupeKey = `${name.toLowerCase()}|${lat.toFixed(3)}|${lon.toFixed(3)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const tags = el.tags;
    const state = inferState(tags, lat, lon);
    const osmId = `${el.type}/${el.id}`;

    const facilities = {
      parking: tags['amenity'] === 'parking' || tags['parking'] === 'yes',
      toilets: tags['toilets'] === 'yes' || tags['amenity'] === 'toilets',
      showers: tags['shower'] === 'yes',
      cafe: tags['amenity'] === 'cafe' || tags['amenity'] === 'restaurant',
      lifeguard: tags['lifeguard'] === 'yes' || tags['safety:lifeguard'] === 'yes',
    };

    beaches.push({
      osm_id: osmId,
      name,
      slug: toSlug(name, state, osmId),
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
      boundary: extractBoundary(el),
    });
  }

  console.log(`Cleaned to ${beaches.length} unique beaches`);

  const header = [
    'osm_id', 'name', 'slug', 'lat', 'lng', 'state', 'region',
    'beach_type', 'is_dog_friendly', 'is_patrolled',
    'is_wheelchair_accessible', 'surf_rating', 'is_hub_location', 'facilities', 'boundary',
  ].join(',');

  const rows = beaches.map(toCSVRow);
  const csv = [header, ...rows].join('\n');

  const csvPath = path.join(OUTPUT_DIR, 'beaches.csv');
  fs.writeFileSync(csvPath, csv);
  console.log(`CSV written to ${csvPath}`);
  console.log('\nNext step: run scripts/seed-beaches.ts to import into Supabase.');
}

main().catch((e) => { console.error(e); process.exit(1); });
