// Deno / Edge Function runtime — uses esm.sh imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Service role client — bypasses RLS. Only used inside Edge Functions.
// NEVER ship this to the client app.
export function createServiceRoleClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
