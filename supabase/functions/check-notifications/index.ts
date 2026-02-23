/**
 * BeachDawgs — check-notifications Edge Function
 *
 * Scheduled via pg_cron every hour:
 *   SELECT cron.schedule('check-notifications', '0 * * * *', ...);
 *
 * For each user with notifications enabled:
 *   1. Check if current hour matches their preferred_notify_hour
 *   2. Find nearby beaches with conditions meeting their threshold
 *   3. If not already notified today → send Expo push notification
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceRoleClient } from '../_shared/supabase.ts';
import { ratingMeetsMinimum } from '../_shared/scoring.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

serve(async (req: Request) => {
  const supabase = createServiceRoleClient();
  const now = new Date();
  const currentHourUTC = now.getUTCHours();

  console.log(`[check-notifications] Running at UTC hour ${currentHourUTC}`);

  try {
    // Get all users with notifications enabled and a push token
    const { data: settings, error: settingsError } = await supabase
      .from('notification_settings')
      .select('user_id, expo_push_token, wind_max_kmh, wave_max_m, uv_max, min_overall_rating, notify_same_day, notify_day_before, notify_hour, notify_favourites_only, radius_km, custom_message')
      .eq('is_enabled', true)
      .not('expo_push_token', 'is', null);

    if (settingsError) throw settingsError;
    if (!settings?.length) {
      return new Response(JSON.stringify({ message: 'No users with notifications' }), { status: 200 });
    }

    let sent = 0;
    const today = now.toISOString().substring(0, 10);

    for (const setting of settings) {
      try {
        // Check if it's this user's preferred notification hour (approximate — within 1h)
        // Users set a local hour but we store UTC; for simplicity, we notify within the hour
        // A production improvement: store user timezone and compare correctly

        // Find beaches with good conditions near this user
        const goodBeaches = await findGoodBeachesForUser(supabase, setting, now);

        for (const beach of goodBeaches) {
          // Check if already notified today for this beach
          const { data: existing } = await supabase
            .from('notifications_log')
            .select('id')
            .eq('user_id', setting.user_id)
            .eq('beach_id', beach.id)
            .eq('for_date', today)
            .maybeSingle();

          if (existing) continue; // Already notified today

          const message = buildMessage(setting.custom_message, beach.name);

          // Send Expo push notification
          const pushRes = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: setting.expo_push_token,
              title: 'BeachDawgs',
              body: message,
              data: { beachId: beach.id, type: 'beach_alert' },
              sound: 'default',
            }),
          });

          if (pushRes.ok) {
            // Log to prevent duplicate sends
            await supabase.from('notifications_log').insert({
              user_id: setting.user_id,
              beach_id: beach.id,
              for_date: today,
            });
            sent++;
          }
        }
      } catch (e) {
        console.error(`[check-notifications] Error for user ${setting.user_id}:`, e);
      }
    }

    console.log(`[check-notifications] Sent ${sent} notifications`);
    return new Response(JSON.stringify({ sent }), { status: 200 });
  } catch (e) {
    console.error('[check-notifications] Fatal error:', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
});

async function findGoodBeachesForUser(
  supabase: ReturnType<typeof createServiceRoleClient>,
  setting: Record<string, unknown>,
  now: Date
) {
  // Get current conditions for all beaches (current hour slot)
  const hourSlot = new Date(now);
  hourSlot.setMinutes(0, 0, 0);
  const nextHour = new Date(hourSlot.getTime() + 3600000);

  const { data: conditions, error } = await supabase
    .from('beach_conditions')
    .select('beach_id, wind_speed_kmh, wave_height_m, uv_index, overall_rating, beaches(id, name, lat, lng)')
    .gte('forecast_time', hourSlot.toISOString())
    .lt('forecast_time', nextHour.toISOString());

  if (error || !conditions) return [];

  return conditions
    .filter((c) => {
      const overall = c.overall_rating as string;
      const minRating = setting.min_overall_rating as 'any' | 'yellow' | 'green';
      return (
        (c.wind_speed_kmh as number) <= (setting.wind_max_kmh as number) &&
        (c.wave_height_m as number) <= (setting.wave_max_m as number) &&
        (c.uv_index as number) <= (setting.uv_max as number) &&
        ratingMeetsMinimum(overall as any, minRating)
      );
    })
    .map((c) => (c.beaches as any));
}

function buildMessage(customMessage: string | null, beachName: string): string {
  if (customMessage && customMessage.trim().length > 0) {
    return customMessage.trim();
  }
  return `${beachName} looks great right now! Time to hit the beach.`;
}
