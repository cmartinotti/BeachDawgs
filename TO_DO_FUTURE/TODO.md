# BeachDawgs — Future To-Do

Items that need attention but were deferred.

---

## 🔐 Security

### Rotate Supabase service role key
- **Why:** The key was accidentally hardcoded in `scripts/run-seed.mjs` and committed to local git history (GitHub push protection blocked it from reaching remote, but the key should still be considered exposed)
- **How:** Supabase Dashboard → Project Settings → API → regenerate `service_role` key → update local `.env`
- **Also:** Ensure `.env` is in `.gitignore` and never hardcode keys in scripts again — use env vars

---

## 🗺️ Missing Beach Polygons

187 beaches render as circles because they are OSM `node` elements (single point, no area geometry).
See `TO_DO_FUTURE/missing-polygons.md` and `missing-polygons.json` for the full list.

Options:
1. Wait for OSM contributors to re-map them as `way` polygons
2. Contribute the polygons to OSM yourself
3. Generate synthetic ellipses in code as a visual approximation

---

## ⚙️ Notification Settings UI

The `notification_settings` table has three columns that the edge function now uses, but the settings screen doesn't expose them to the user:
- `uv_max` — maximum UV index threshold for notifications
- `radius_km` — distance radius for beach filtering
- `notify_favourites_only` — restrict notifications to saved beaches only
