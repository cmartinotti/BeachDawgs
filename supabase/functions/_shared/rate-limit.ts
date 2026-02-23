import { createServiceRoleClient } from './supabase.ts';

/**
 * Checks and increments a rate limit counter for a given user + function.
 * Uses a Postgres-backed atomic increment — no Redis needed.
 *
 * @param userId       Supabase user.id
 * @param functionName e.g. 'checkin-verify'
 * @param maxRequests  Maximum allowed requests in the window
 * @param windowHours  Window size in hours (default: 1)
 */
export async function checkRateLimit(
  userId: string,
  functionName: string,
  maxRequests: number,
  windowHours = 1
): Promise<void> {
  const supabase = createServiceRoleClient();

  // Snap to window boundary (e.g., 14:00:00 for hourly windows)
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setMinutes(0, 0, 0);
  if (windowHours > 1) {
    const hourSlot = Math.floor(now.getHours() / windowHours) * windowHours;
    windowStart.setHours(hourSlot, 0, 0, 0);
  }

  const { data, error } = await supabase.rpc('increment_rate_limit_counter', {
    p_user_id: userId,
    p_function_name: functionName,
    p_window_start: windowStart.toISOString(),
    p_max_requests: maxRequests,
  });

  if (error) {
    // Log error but don't block the request — rate limit is a best-effort guard
    console.error('[RateLimit] Counter increment error:', error.message);
    return;
  }

  const exceeded = data?.[0]?.exceeded ?? false;

  if (exceeded) {
    const retryAfter = Math.ceil((windowStart.getTime() + windowHours * 3600000 - Date.now()) / 1000);
    throw new Response(
      JSON.stringify({
        error: `Rate limit exceeded. Max ${maxRequests} requests per ${windowHours}h window.`,
        retry_after_seconds: retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
        },
      }
    );
  }
}
