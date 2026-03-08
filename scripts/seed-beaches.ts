/**
 * seed-beaches.ts
 *
 * One-off script: reads scripts/output/beaches.csv and bulk-inserts into
 * the Supabase `beaches` table using the service-role key.
 *
 * Usage (after running fetch-osm-beaches.ts):
 *   SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... npx ts-node scripts/seed-beaches.ts
 *
 * Or set env vars in a local .env.seed file and source it:
 *   export $(cat .env.seed | xargs) && npx ts-node scripts/seed-beaches.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CSV_PATH = path.join(__dirname, 'output', 'beaches.csv');
const BATCH_SIZE = 100;

function parseCSV(content: string) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');

  return lines.slice(1).map((line) => {
    // Simple CSV parser (handles quoted JSON in facilities column)
    const values: string[] = [];
    let inQuote = false;
    let current = '';

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQuote) { inQuote = true; continue; }
      if (ch === '"' && inQuote) {
        if (line[i + 1] === '"') { current += '"'; i++; continue; }
        inQuote = false;
        continue;
      }
      if (ch === ',' && !inQuote) { values.push(current); current = ''; continue; }
      current += ch;
    }
    values.push(current);

    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      const v = values[i] ?? '';
      if (h === 'lat' || h === 'lng' || h === 'surf_rating') {
        obj[h] = parseFloat(v);
      } else if (h === 'is_dog_friendly' || h === 'is_patrolled' || h === 'is_wheelchair_accessible' || h === 'is_hub_location') {
        obj[h] = v === 'true';
      } else if (h === 'facilities') {
        try { obj[h] = JSON.parse(v); } catch { obj[h] = {}; }
      } else if (h === 'boundary') {
        obj[h] = v ? JSON.parse(v) : null;
      } else if (h === 'state' && v === 'Unknown') {
        obj[h] = null; // will be filtered out below
      } else {
        obj[h] = v;
      }
    });
    return obj;
  });
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found at ${CSV_PATH}. Run fetch-osm-beaches.ts first.`);
    process.exit(1);
  }

  const content = fs.readFileSync(CSV_PATH, 'utf8');
  const allBeaches = parseCSV(content);
  const beaches = allBeaches.filter((b) => b['state'] !== null && b['state'] !== 'Unknown' && b['state'] !== '');
  console.log(`Parsed ${allBeaches.length} beaches from CSV, ${beaches.length} have a known state (${allBeaches.length - beaches.length} skipped).`);

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < beaches.length; i += BATCH_SIZE) {
    const batch = beaches.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from('beaches')
      .upsert(batch as any[], { onConflict: 'osm_id' });

    if (error) {
      console.error(`Batch ${i}–${i + BATCH_SIZE} error:`, error.message);
      skipped += batch.length;
    } else {
      inserted += batch.length;
      process.stdout.write(`\rInserted ${inserted}/${beaches.length}...`);
    }

    // Polite rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n\nDone! ${inserted} inserted, ${skipped} skipped.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
