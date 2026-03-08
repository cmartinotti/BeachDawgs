# Missing Beach Polygons

## Problem

187 beaches in the database render as **circles** instead of polygons on the map.
All of them are OSM **node** elements — a single GPS point with no area geometry.

## Why it happens

OpenStreetMap has three element types:
- **node** — a single lat/lng point (no shape)
- **way** — an ordered list of nodes forming a line or polygon ✓ (we handle these)
- **relation** — a group of ways/nodes forming complex shapes (e.g. multipolygons)

Our Overpass query fetches all three, but only `way` elements include polygon geometry
(`geometry: [{lat, lon}, ...]`). A `node` is just a point — there is no polygon to extract,
so the app correctly falls back to a circle.

## Root cause

The OSM contributors who added these beaches mapped them as a single pin rather than
drawing the full beach boundary. This is common for smaller, remote, or less-visited beaches.

## Resolution options

### Option A — Wait for OSM data to improve (no dev work)
OSM data improves continuously. Re-run the fetch+seed pipeline periodically:
```bash
TS_NODE_PROJECT=tsconfig.scripts.json npx ts-node scripts/fetch-osm-beaches.ts
node scripts/reprocess-beaches.mjs
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... TS_NODE_PROJECT=tsconfig.scripts.json npx ts-node scripts/seed-beaches.ts
```

### Option B — Contribute to OSM (no dev work, long-term benefit)
Go to https://www.openstreetmap.org, find a node beach from the index below,
and re-map it as a way (polygon) by tracing the satellite imagery.
The next pipeline run will pick it up automatically.

### Option C — Generate synthetic ellipse polygons (dev work)
For node beaches, generate a synthetic ellipse polygon from the centroid using
beach_type to determine approximate size (e.g. surf_beach = 600m × 150m oriented
along the coastline bearing). This would fill in all circles but the shapes would
not be accurate — they'd just be placeholders.

## Index of affected beaches

See `missing-polygons.json` for the full machine-readable list (187 entries).

Counts by OSM type:
- node: 187
- relation: 0 (relations were deduplicated against existing way entries during processing)

## Sample affected beaches (first 20 alphabetically)

See `missing-polygons.json` for the complete list with OSM URLs.

| Name | Lat | Lng | OSM Link |
|---|---|---|---|
| 10 Mile Lagoon | -33.8834 | 121.7529 | [OSM](https://www.openstreetmap.org/node/7021524676) |
| Almonta Beach | -34.6815 | 135.3444 | [OSM](https://www.openstreetmap.org/node/3439003836) |
| Alva Beach | -19.4546 | 147.4831 | [OSM](https://www.openstreetmap.org/node/2452719314) |
| Anzacs | -38.5386 | 145.3330 | [OSM](https://www.openstreetmap.org/node/2828706029) |
| Aussie Track | -38.5316 | 145.3245 | [OSM](https://www.openstreetmap.org/node/2828706031) |
| Back Beach | -20.3360 | 148.8528 | [OSM](https://www.openstreetmap.org/node/1520189428) |
| Back Beach | -28.7942 | 114.6112 | [OSM](https://www.openstreetmap.org/node/4665554437) |
| Back Beach | -32.0798 | 152.5440 | [OSM](https://www.openstreetmap.org/node/10536240543) |
| Banksia Beach | -18.3564 | 146.3152 | [OSM](https://www.openstreetmap.org/node/6334509266) |
| Bargang | -35.2282 | 149.0640 | [OSM](https://www.openstreetmap.org/node/2283054193) |
| Betka Beach | -37.5856 | 149.7384 | [OSM](https://www.openstreetmap.org/node/1789975253) |
| Bicton Baths | -32.0283 | 115.7776 | [OSM](https://www.openstreetmap.org/node/12484778050) |
| Bimbi Beach | -35.2296 | 149.0740 | [OSM](https://www.openstreetmap.org/node/2283054200) |
| Binalong Bay | -41.2520 | 148.3048 | [OSM](https://www.openstreetmap.org/node/597971749) |
| Blinking Billy Beach | -42.9155 | 147.3600 | [OSM](https://www.openstreetmap.org/node/10294498109) |
| Blue Lake Beach | -27.5942 | 153.4764 | [OSM](https://www.openstreetmap.org/node/13016046528) |
| Boomer Beach | -35.5362 | 138.6732 | [OSM](https://www.openstreetmap.org/node/1349114800) |
| Boyfriend Beach | -37.9538 | 147.6643 | [OSM](https://www.openstreetmap.org/node/7795802277) |
| Broadwater Beach | -29.0313 | 153.4568 | [OSM](https://www.openstreetmap.org/node/3501004869) |
| Brodie's Beach | -12.3454 | 130.9284 | [OSM](https://www.openstreetmap.org/node/13465287652) |
