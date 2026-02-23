/**
 * BeachDawgs — fetch-conditions Edge Function
 *
 * Scheduled via Supabase pg_cron every 3 hours:
 *   SELECT cron.schedule('fetch-conditions', '0 */3 * * *',
 *     $$SELECT net.http_post(url := 'https://<project>.supabase.co/functions/v1/fetch-conditions',
 *       headers := '{"Authorization": "Bearer <service_role_key>"}')$$);
 *
 * Fetches weather from Open-Meteo (all beaches) and Stormglass (hub locations only).
 * Upserts into beach_conditions. Users never hit weather APIs directly.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceRoleClient } from '../_shared/supabase.ts';
import { scoreConditions } from '../_shared/scoring.ts';

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_MARINE = 'https://marine-api.open-meteo.com/v1/marine';
const STORMGLASS_BASE = 'https://api.stormglass.io/v2';

const STORMGLASS_API_KEY = Deno.env.get('STORMGLASS_API_KEY') ?? '';
const FETCH_BATCH_SIZE = 50; // Process beaches in batches to avoid memory issues

serve(async (req: Request) => {
  // This function is called by pg_cron with service_role auth, not by users
  const authHeader = req.headers.get('Authorization');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!authHeader || !authHeader.includes(serviceKey.substring(0, 20))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const now = new Date();

  console.log(`[fetch-conditions] Starting at ${now.toISOString()}`);

  try {
    // Fetch all beaches (id, lat, lng, is_hub_location)
    const { data: beaches, error: beachError } = await supabase
      .from('beaches')
      .select('id, lat, lng, is_hub_location, state');

    if (beachError) throw beachError;
    if (!beaches?.length) {
      return new Response(JSON.stringify({ message: 'No beaches found' }), { status: 200 });
    }

    console.log(`[fetch-conditions] Processing ${beaches.length} beaches`);

    let processed = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < beaches.length; i += FETCH_BATCH_SIZE) {
      const batch = beaches.slice(i, i + FETCH_BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (beach) => {
          try {
            await fetchAndStoreBeachConditions(supabase, beach, now);
            processed++;
          } catch (e) {
            errors++;
            console.error(`[fetch-conditions] Error for beach ${beach.id}:`, e);
          }
        })
      );

      // Small delay between batches to be respectful to Open-Meteo
      if (i + FETCH_BATCH_SIZE < beaches.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    console.log(`[fetch-conditions] Done. Processed: ${processed}, Errors: ${errors}`);
    return new Response(
      JSON.stringify({ processed, errors }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[fetch-conditions] Fatal error:', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
});

async function fetchAndStoreBeachConditions(
  supabase: ReturnType<typeof createServiceRoleClient>,
  beach: { id: string; lat: number; lng: number; is_hub_location: boolean; state: string },
  now: Date
) {
  const timezone = stateToTimezone(beach.state);

  // ─── Open-Meteo Forecast ───────────────────────────────────────────────────
  const forecastUrl = new URL(OPEN_METEO_BASE);
  forecastUrl.searchParams.set('latitude', String(beach.lat));
  forecastUrl.searchParams.set('longitude', String(beach.lng));
  forecastUrl.searchParams.set('hourly', [
    'windspeed_10m', 'winddirection_10m', 'windgusts_10m',
    'uv_index', 'precipitation_probability', 'cloudcover', 'visibility',
    'temperature_2m',
  ].join(','));
  forecastUrl.searchParams.set('daily', 'sunrise,sunset');
  forecastUrl.searchParams.set('timezone', timezone);
  forecastUrl.searchParams.set('forecast_days', '7');
  forecastUrl.searchParams.set('windspeed_unit', 'kmh');

  const forecastRes = await fetch(forecastUrl.toString());
  if (!forecastRes.ok) throw new Error(`Open-Meteo forecast HTTP ${forecastRes.status}`);
  const forecast = await forecastRes.json();

  // ─── Open-Meteo Marine ─────────────────────────────────────────────────────
  const marineUrl = new URL(OPEN_METEO_MARINE);
  marineUrl.searchParams.set('latitude', String(beach.lat));
  marineUrl.searchParams.set('longitude', String(beach.lng));
  marineUrl.searchParams.set('hourly', [
    'wave_height', 'wave_direction', 'wave_period',
    'swell_wave_height', 'swell_wave_period',
  ].join(','));
  marineUrl.searchParams.set('timezone', timezone);
  marineUrl.searchParams.set('forecast_days', '7');

  const marineRes = await fetch(marineUrl.toString());
  if (!marineRes.ok) throw new Error(`Open-Meteo marine HTTP ${marineRes.status}`);
  const marine = await marineRes.json();

  // ─── Stormglass (hub locations only — water temp + tides) ─────────────────
  let waterTempByHour: Record<string, number> = {};
  if (beach.is_hub_location && STORMGLASS_API_KEY) {
    try {
      const sgUrl = `${STORMGLASS_BASE}/weather/point?lat=${beach.lat}&lng=${beach.lng}&params=waterTemperature`;
      const sgRes = await fetch(sgUrl, {
        headers: { Authorization: STORMGLASS_API_KEY },
      });
      if (sgRes.ok) {
        const sgData = await sgRes.json();
        for (const hour of sgData.hours ?? []) {
          const t = new Date(hour.time).toISOString();
          const val = hour.waterTemperature?.noaa ?? hour.waterTemperature?.sg;
          if (val !== undefined) waterTempByHour[t] = val;
        }
      }
    } catch (e) {
      console.warn(`[fetch-conditions] Stormglass failed for hub ${beach.id}:`, e);
    }
  }

  // ─── Build sunrise/sunset map by date ─────────────────────────────────────
  const sunriseBySunset: Record<string, { sunrise: string; sunset: string }> = {};
  const dailyTimes = forecast.daily;
  for (let d = 0; d < dailyTimes.time.length; d++) {
    const date = dailyTimes.time[d];
    sunriseBySunset[date] = {
      sunrise: dailyTimes.sunrise[d],
      sunset: dailyTimes.sunset[d],
    };
  }

  // ─── Build upsert rows for each hourly slot ────────────────────────────────
  const hourlyTimes: string[] = forecast.hourly.time;
  const rows = hourlyTimes.map((time, idx) => {
    const date = time.substring(0, 10); // YYYY-MM-DD
    const dayData = sunriseBySunset[date] ?? {};

    const windSpeed = forecast.hourly.windspeed_10m[idx] ?? 0;
    const windGusts = forecast.hourly.windgusts_10m[idx] ?? 0;
    const waveHeight = marine.hourly?.wave_height?.[idx] ?? 0;
    const cloudCover = forecast.hourly.cloudcover[idx] ?? 0;
    const visibility = forecast.hourly.visibility[idx] ?? 0;
    const precipProb = forecast.hourly.precipitation_probability[idx] ?? 0;

    const ratings = scoreConditions({
      wind_speed_kmh: windSpeed,
      wind_gusts_kmh: windGusts,
      wave_height_m: waveHeight,
      cloud_cover: cloudCover,
      visibility_m: visibility,
      precipitation_probability: precipProb,
    });

    return {
      beach_id: beach.id,
      forecast_time: new Date(time).toISOString(),
      fetched_at: now.toISOString(),
      wind_speed_kmh: windSpeed,
      wind_direction_deg: forecast.hourly.winddirection_10m[idx],
      wind_gusts_kmh: windGusts,
      wave_height_m: waveHeight,
      wave_direction_deg: marine.hourly?.wave_direction?.[idx],
      wave_period_s: marine.hourly?.wave_period?.[idx],
      swell_height_m: marine.hourly?.swell_wave_height?.[idx],
      swell_period_s: marine.hourly?.swell_wave_period?.[idx],
      water_temp_c: waterTempByHour[new Date(time).toISOString()] ?? null,
      air_temp_c: forecast.hourly.temperature_2m[idx],
      uv_index: forecast.hourly.uv_index[idx],
      precipitation_probability: precipProb,
      cloud_cover: cloudCover,
      visibility_m: visibility,
      sunrise: dayData.sunrise ? new Date(dayData.sunrise).toISOString() : null,
      sunset: dayData.sunset ? new Date(dayData.sunset).toISOString() : null,
      ...ratings,
    };
  });

  // Upsert in chunks of 168 (7 days × 24 hours)
  const { error } = await supabase
    .from('beach_conditions')
    .upsert(rows, { onConflict: 'beach_id,forecast_time' });

  if (error) throw error;
}

function stateToTimezone(state: string): string {
  const map: Record<string, string> = {
    NSW: 'Australia/Sydney',
    ACT: 'Australia/Sydney',
    VIC: 'Australia/Melbourne',
    QLD: 'Australia/Brisbane',
    SA: 'Australia/Adelaide',
    WA: 'Australia/Perth',
    TAS: 'Australia/Hobart',
    NT: 'Australia/Darwin',
  };
  return map[state] ?? 'Australia/Sydney';
}
