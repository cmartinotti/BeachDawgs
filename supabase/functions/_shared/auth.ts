import { createServiceRoleClient } from './supabase.ts';

/**
 * Validates the Bearer JWT in the Authorization header.
 * Returns the authenticated user object.
 *
 * IMPORTANT: Always extract user.id from the JWT — never from the request body.
 * A malicious client could send any user_id; the JWT is the authoritative source.
 */
export async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Response(
      JSON.stringify({ error: 'Missing or malformed Authorization header' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createServiceRoleClient();

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Response(
      JSON.stringify({ error: 'Invalid or expired token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return user;
}
