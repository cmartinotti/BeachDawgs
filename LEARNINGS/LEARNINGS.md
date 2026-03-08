# BeachDawgs — Hard-Won Technical Learnings

Lessons that cost real debugging time. Written so we never have to learn them twice.

---

## 1. React Native: horizontal FlatList clips sibling content when a list loads below it

**Where:** `app/(app)/(tabs)/explore.tsx`

**Symptom:** State-filter chips rendered correctly for a split second after reload, then the text was clipped vertically. Happened every time the beach list loaded and appeared.

**Root cause:** In a `flex: 1` column with no explicit sizes, React Native's layout engine lets children fight for vertical space on every re-render. `FlatList` recalculates layout via virtualisation on data changes. When the beach list received data and remeasured, it squeezed the chip row above.

**Dead ends tried:**
- `alignItems: 'center'` on the horizontal FlatList's `contentContainerStyle` — caused a 0-height container that overflowed chips upward (worse)
- Fixed `height` on the FlatList `style` — virtualisation kept stomping it on re-renders
- Swapping the horizontal FlatList for a `ScrollView` — still clipped because the fundamental flex competition remained

**What actually fixed it (two changes needed together):**

```tsx
// 1. Wrap chip row in a View with an immutable height
<View style={{ height: 60 }}>
  <ScrollView horizontal contentContainerStyle={styles.stateRow}>
    {STATES.map((state) => <Pressable key={state} ... />)}
  </ScrollView>
</View>

// 2. Give the beach list flex: 1 so it explicitly owns the remaining space
<FlatList style={{ flex: 1 }} ... />
```

Also: replace `paddingVertical` on chips with fixed `height` + `justifyContent/alignItems: 'center'` — removes font-measurement dependency entirely:

```ts
stateChip: {
  height: 44,
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: spacing.lg,
  borderRadius: radius.full,
  borderWidth: 1,
},
```

**The rule:** In a `flex: 1` column, always wrap fixed-height UI in a `View` with an explicit `height`, and give the scrollable list `flex: 1`. Never rely on padding alone to reserve height for siblings of a FlatList.

---

## 2. React Native: small static chip lists should be ScrollView, not FlatList

**Where:** `app/(app)/(tabs)/explore.tsx`

**Issue:** Using a horizontal `FlatList` for 8 fixed state chips introduced virtualisation overhead and unstable height calculation for no benefit. FlatList is optimised for large, dynamic, unknown-length lists.

**Fix:** For ≤~20 static items in a horizontal scroll, always use `ScrollView`:

```tsx
<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
  {items.map(item => <Chip key={item} ... />)}
</ScrollView>
```

Benefits: single layout pass, stable height, simpler code, no virtualisation interference.

---

## 3. OSM Overpass: `out center geom tags` drops the `center` property for ways

**Where:** `scripts/fetch-osm-beaches.ts`, `scripts/reprocess-beaches.mjs`

**What happened:** Changing the Overpass query from `out center tags` to `out center geom tags` to get polygon geometry seemed like a safe addition. But Overpass removes the `center` property from `way` elements when `geom` is requested — only the raw `geometry` array is returned.

**Result:** First run produced only 187 beaches instead of 2028. The `1620` way-type beaches all had `lat: undefined` and were silently skipped by `if (!lat || !lon) continue`.

**Fix:** Compute centroid from the geometry array when `center` is absent:

```ts
let lat = el.lat ?? el.center?.lat;
let lon = el.lon ?? el.center?.lon;

if ((!lat || !lon) && el.geometry?.length) {
  lat = el.geometry.reduce((s, p) => s + p.lat, 0) / el.geometry.length;
  lon = el.geometry.reduce((s, p) => s + p.lon, 0) / el.geometry.length;
}

if (!lat || !lon) continue; // now only skips genuine duds
```

**Rule:** When using Overpass `out geom`, never assume `center` is still present. Always derive the centroid from `geometry` yourself for way elements.

---

## 4. Supabase: `ignoreDuplicates: true` silently skips ALL existing rows

**Where:** `scripts/seed-beaches.ts`

**What happened:** After fixing OSM fetch to return polygon boundaries, the seed script ran and reported "1799 inserted" with no errors. But the app still showed circles — `boundary` was null in the DB for all beaches. The script was:

```ts
.upsert(batch, { onConflict: 'osm_id', ignoreDuplicates: true })
```

`ignoreDuplicates: true` = `INSERT ... ON CONFLICT DO NOTHING`. Since all beaches already existed from a prior seed, every row was silently skipped. No error, no warning, no updated data.

**Fix:** Remove `ignoreDuplicates` to get true upsert (insert or update):

```ts
.upsert(batch as any[], { onConflict: 'osm_id' })
```

**Rule:** `ignoreDuplicates: true` in Supabase upserts will NEVER update existing rows. Only use it when you genuinely want insert-only and to skip duplicates silently. For re-seeding data that may have changed, always omit it.

---

## 5. Cross-tab navigation with map animation: use a Zustand pending-action pattern

**Where:** `src/store/mapStore.ts`, `app/(app)/(tabs)/explore.tsx`, `app/(app)/(tabs)/index.tsx`

**Problem:** Tapping a beach in the Explore tab needed to switch to the Map tab AND animate the map to the beach's coordinates. Expo Router tabs don't share refs, and `router.push('/')` gives no way to pass imperative actions to the destination screen.

**Solution:** Store a pending action in shared Zustand state; the destination screen consumes and clears it on mount/update:

```ts
// mapStore.ts
interface PendingFocusBeach { id: string; lat: number; lng: number; }
pendingFocusBeach: PendingFocusBeach | null;
setPendingFocusBeach: (beach: PendingFocusBeach | null) => void;
```

```ts
// explore.tsx — set and navigate
setPendingFocusBeach({ id: beach.id, lat: beach.lat, lng: beach.lng });
router.push('/');
```

```ts
// index.tsx — consume and clear
useEffect(() => {
  if (!pendingFocusBeach) return;
  setSelectedBeach(pendingFocusBeach.id);
  mapRef.current?.animateToRegion({
    latitude: pendingFocusBeach.lat,
    longitude: pendingFocusBeach.lng,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  }, 800);
  bottomSheetRef.current?.snapToIndex(1);
  setPendingFocusBeach(null); // always clear after consuming
}, [pendingFocusBeach]);
```

**The pattern:** For cross-tab imperative actions in Expo Router, use shared state as a "message queue" — producer sets, consumer reads and clears. Works cleanly for any action that can't be expressed as a URL param.

---

## 6. Geospatial: bounding box alone over-selects; always post-filter with haversine

**Where:** `src/hooks/useNearbyBeaches.ts`, `app/(app)/(tabs)/explore.tsx`

**Issue:** A lat/lng bounding box is a square. At 30km radius, it includes beaches up to ~42km away (the corners of the square). With a large radius or a city near a coast, this can return many more beaches than intended.

**Pattern:** Use bounding box for the DB query (Postgres can index-scan it efficiently), then haversine post-filter in JS for a true circle:

```ts
// DB query — rough bounding box
const { minLat, maxLat, minLng, maxLng } = boundingBox(userCoord, NEARBY_RADIUS_METRES);
query.gte('lat', minLat).lte('lat', maxLat).gte('lng', minLng).lte('lng', maxLng);

// JS post-filter — precise circle
.filter(beach => haversineMetres(userCoord, beach) <= NEARBY_RADIUS_METRES)
```

---

## 7. OSM: node elements can never have polygon geometry

**Where:** `scripts/fetch-osm-beaches.ts`, `src/components/map/BeachMarker.tsx`

**Discovery:** OSM has three element types. Their rendering capability differs:

| Type | Count (our DB) | Polygon possible? |
|------|---------------|-------------------|
| `way` | 1,620 | ✅ Yes — `geometry` array of points |
| `relation` | 221 | ⚠️ Complex multipolygon, not yet handled |
| `node` | 187 | ❌ No — single GPS point only |

The 187 node beaches will always render as circles. This is correct behaviour, not a bug. Resolution options: wait for OSM contributors to re-map them as ways, contribute to OSM yourself, or generate synthetic ellipses in code. Tracked in `TO_DO_FUTURE/missing-polygons.md`.

---

## 8. Supabase Edge Function: always verify filtering logic is actually applied

**Where:** `supabase/functions/check-notifications/index.ts`

**Issue:** The `check-notifications` function fetched three user preferences from the DB (`notify_hour`, `radius_km`, `notify_favourites_only`) but silently did nothing with them. No filtering was applied, and no error was thrown. The code just continued past all three values.

**Lesson:** When an edge function fetches settings/preferences, immediately audit whether each fetched value is actually used downstream. Patterns that fetch-but-ignore are easy to introduce and hard to spot in code review.

**Fixes:**
- `notify_hour` — compare against `new Date().getUTCHours()` before sending any notifications
- `radius_km` — look up user's home beach, apply haversine filter on the beach list
- `notify_favourites_only` — fetch `user_beaches`, build a Set of IDs, filter conditions to only those

---

## 9. Date maths: `getUTCHours()` always returns 0–23; impossible conditions are silent bugs

**Where:** `supabase/functions/checkin-verify/index.ts`

**Bug:**
```ts
const hour = new Date().getUTCHours(); // always 0–23
if (hour >= 20 || hour < 0) earn('dawn_patrol'); // hour < 0 is IMPOSSIBLE
```

`hour < 0` could never be true. Half the intended time window was dead code. Additionally the `hour >= 20` window was too narrow and didn't correctly map to midnight–7am AEST/AEDT.

**Fix — reasoning through timezone maths:**
- AEST = UTC+10, AEDT = UTC+11
- Midnight–7am AEST = 14:00–21:00 UTC
- Midnight–7am AEDT = 13:00–20:00 UTC
- Conservative window covering both: `hour >= 13 && hour < 21`

```ts
if (hour >= 13 && hour < 21) earn('dawn_patrol');
```

**Rule:** When writing UTC time-window conditions for Australian timezones, always work out the UTC range explicitly. Test `>= X && < Y` rather than `>= X || < Y` (the `||` form is almost always a bug for window checks).

---

## 10. TypeScript / Node.js: `__dirname` is not available in ESM module scope

**Where:** `scripts/fetch-osm-beaches.ts`

**Error:**
```
ReferenceError: __dirname is not defined in ES module scope
```

**Cause:** The project's main `tsconfig.json` targets an ESM-compatible module format. `__dirname` is a CommonJS global that doesn't exist in ESM.

**Fix:** A separate `tsconfig.scripts.json` that overrides to CommonJS just for the scripts directory:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node"
  },
  "include": ["scripts/**/*.ts"]
}
```

Run scripts with:
```bash
TS_NODE_PROJECT=tsconfig.scripts.json npx ts-node scripts/fetch-osm-beaches.ts
```
