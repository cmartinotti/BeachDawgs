/**
 * BeachDawgs — checkin-verify Edge Function
 *
 * Called by the mobile app when a user taps "Check In".
 * Validates GPS proximity, enforces rate limits, awards points and badges.
 *
 * Request body: { beachId: string, latitude: number, longitude: number }
 * Authorization: Bearer <user_jwt>
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { validateUUID, validateCoordinates } from '../_shared/validation.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { createServiceRoleClient } from '../_shared/supabase.ts';

const CHECKIN_RADIUS_METRES = 300;
const POINTS_CHECKIN_BASE = 20;
const POINTS_RECOMMENDED_BONUS = 15;
const POINTS_FIRST_VISIT_BONUS = 20;

serve(async (req: Request) => {
  const supabase = createServiceRoleClient();

  try {
    // 1. Authenticate — user.id from JWT, never from body
    const user = await getAuthenticatedUser(req);

    // 2. Rate limit: max 10 checkin attempts per hour
    await checkRateLimit(user.id, 'checkin-verify', 10, 1);

    // 3. Parse and validate input
    const body = await req.json().catch(() => ({}));
    const beachId = validateUUID(body.beachId, 'beachId');
    const { lat: userLat, lng: userLng } = validateCoordinates(body.latitude, body.longitude);

    // 4. Fetch beach coordinates
    const { data: beach, error: beachError } = await supabase
      .from('beaches')
      .select('id, name, lat, lng')
      .eq('id', beachId)
      .single();

    if (beachError || !beach) {
      return errorResponse(404, 'Beach not found');
    }

    // 5. GPS distance check (Haversine)
    const distanceM = haversineMetres(
      { lat: userLat, lng: userLng },
      { lat: Number(beach.lat), lng: Number(beach.lng) }
    );
    const isVerified = distanceM <= CHECKIN_RADIUS_METRES;

    if (!isVerified) {
      return errorResponse(422, `You must be within ${CHECKIN_RADIUS_METRES}m of the beach. Current distance: ${Math.round(distanceM)}m`);
    }

    // 6. Check for duplicate checkin today
    const today = new Date().toISOString().substring(0, 10); // UTC date YYYY-MM-DD
    const { data: existingCheckin } = await supabase
      .from('check_ins')
      .select('id')
      .eq('user_id', user.id)
      .eq('beach_id', beachId)
      .eq('checked_in_date', today)
      .maybeSingle();

    if (existingCheckin) {
      return errorResponse(409, 'You have already checked in at this beach today');
    }

    // 7. Determine if first-ever visit to this beach
    const { data: previousVisits } = await supabase
      .from('check_ins')
      .select('id')
      .eq('user_id', user.id)
      .eq('beach_id', beachId)
      .limit(1);

    const isFirstVisit = !previousVisits?.length;

    // 8. Determine if this was a recommended beach today
    // A beach is "recommended" if it currently has a green overall_rating
    const { data: conditions } = await supabase
      .from('beach_conditions')
      .select('overall_rating')
      .eq('beach_id', beachId)
      .gte('forecast_time', `${today}T00:00:00Z`)
      .lte('forecast_time', `${today}T23:59:59Z`)
      .order('forecast_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    const wasRecommended = conditions?.overall_rating === 'green';

    // 9. Snapshot current conditions
    const conditionsSnapshot = conditions ?? null;

    // 10. Calculate points
    let pointsAwarded = POINTS_CHECKIN_BASE;
    const badgesEarned: string[] = [];

    if (wasRecommended) pointsAwarded += POINTS_RECOMMENDED_BONUS;
    if (isFirstVisit) pointsAwarded += POINTS_FIRST_VISIT_BONUS;

    // 11. Round coordinates server-side before storage (4dp = ~11m precision)
    const storedLat = Math.round(userLat * 10000) / 10000;
    const storedLng = Math.round(userLng * 10000) / 10000;

    // 12. Insert check-in
    const { data: checkIn, error: insertError } = await supabase
      .from('check_ins')
      .insert({
        user_id: user.id,
        beach_id: beachId,
        user_lat: storedLat,
        user_lng: storedLng,
        distance_from_beach_m: Math.round(distanceM),
        is_verified: true,
        conditions_snapshot: conditionsSnapshot,
        was_recommended: wasRecommended,
        points_awarded: pointsAwarded,
        badges_earned: badgesEarned,
        is_first_visit: isFirstVisit,
        is_public: true,
        checked_in_date: today, // explicit UTC date for unique constraint
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 13. Update profile totals atomically
    await supabase.rpc('increment_user_stats', {
      p_user_id: user.id,
      p_points: pointsAwarded,
      p_new_beach: isFirstVisit,
    }).catch(() => {
      // Non-fatal — stats can be recalculated
      console.warn('[checkin-verify] increment_user_stats failed for', user.id);
    });

    // 14. Evaluate badges (separate, non-blocking)
    evaluateBadgesAsync(supabase, user.id, beach.name, conditions?.overall_rating ?? null);

    return new Response(
      JSON.stringify({
        success: true,
        checkinId: checkIn.id,
        pointsAwarded,
        totalPoints: null, // Client fetches fresh profile
        isFirstVisit,
        wasRecommended,
        badgesEarned,
        distanceM: Math.round(distanceM),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[checkin-verify] Unhandled error:', e);
    return errorResponse(500, 'Internal server error');
  }
});

// ─── Haversine ────────────────────────────────────────────────────────────────
function haversineMetres(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sin2DLat = Math.sin(dLat / 2) ** 2;
  const sin2DLng = Math.sin(dLng / 2) ** 2;
  const c = sin2DLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sin2DLng;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}
function toRad(d: number) { return (d * Math.PI) / 180; }

// ─── Badge evaluation (fire-and-forget) ──────────────────────────────────────
async function evaluateBadgesAsync(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  beachName: string,
  overallRating: string | null
) {
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('badges, checkin_count, unique_beaches_count')
      .eq('id', userId)
      .single();

    if (!profile) return;

    const existingBadgeIds: string[] = (profile.badges as any[]).map((b: any) => b.badge_id);
    const newBadges: { badge_id: string; earned_at: string }[] = [];
    const now = new Date().toISOString();

    function earn(id: string) {
      if (!existingBadgeIds.includes(id)) {
        newBadges.push({ badge_id: id, earned_at: now });
      }
    }

    // First ever checkin
    if ((profile.checkin_count ?? 0) <= 1) earn('first_splash');
    // 10 unique beaches
    if ((profile.unique_beaches_count ?? 0) >= 10) earn('explorer');
    // 100 total checkins
    if ((profile.checkin_count ?? 0) >= 100) earn('centurion');
    // Golden hour: checked in on a green sunset day
    if (overallRating === 'green') earn('golden_hour');
    // Storm chaser: checked in on a red day
    if (overallRating === 'red') earn('storm_chaser');
    // Dawn patrol: before 7am local — simplified to UTC hour < 21 (approx AEST 7am)
    const hour = new Date().getUTCHours();
    if (hour >= 20 || hour < 0) earn('dawn_patrol'); // Rough AEST/AEDT check

    if (newBadges.length > 0) {
      const allBadges = [...(profile.badges as any[]), ...newBadges];
      await supabase
        .from('user_profiles')
        .update({ badges: allBadges })
        .eq('id', userId);
    }
  } catch (e) {
    console.warn('[checkin-verify] Badge evaluation failed:', e);
  }
}

function errorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}
