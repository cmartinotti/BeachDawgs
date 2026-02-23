/**
 * BeachDawgs — handle-revenuecat-webhook Edge Function
 *
 * Receives RevenueCat subscription events for Apple App Store (iOS)
 * and Google Play Store (Android), updating user_subscriptions.
 *
 * Register in RevenueCat dashboard:
 *   Project → Integrations → Webhooks
 *   URL: https://<project>.supabase.co/functions/v1/handle-revenuecat-webhook
 *   Authentication: Set a webhook secret and store via `supabase secrets set REVENUECAT_WEBHOOK_SECRET=...`
 *
 * The RevenueCat appUserID must be set to the Supabase user.id when initialising
 * the SDK in the mobile app (see src/lib/purchases.ts).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceRoleClient } from '../_shared/supabase.ts';

serve(async (req: Request) => {
  // RevenueCat uses HTTP Basic auth: base64("secret:")
  const authHeader = req.headers.get('Authorization');
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET')!;
  const expectedAuth = `Basic ${btoa(secret + ':')}`;

  if (!authHeader || authHeader !== expectedAuth) {
    console.error('[rc-webhook] Unauthorized request');
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const event = payload.event as Record<string, unknown> | undefined;
  if (!event) {
    return new Response(JSON.stringify({ error: 'Missing event object' }), { status: 400 });
  }

  // appUserID = Supabase user.id (set during Purchases.configure in the app)
  const appUserId = event.app_user_id as string | undefined;
  const eventType = event.type as string | undefined;

  if (!appUserId || !eventType) {
    return new Response(JSON.stringify({ error: 'Missing app_user_id or type' }), { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const paymentSource = (event.store as string) === 'APP_STORE' ? 'apple' : 'google';

  try {
    switch (eventType) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION':
      case 'NON_RENEWING_PURCHASE': {
        const expirationMs = event.expiration_at_ms as number | undefined;
        await supabase.from('user_subscriptions').upsert({
          user_id: appUserId,
          tier: 'premium',
          status: 'active',
          payment_source: paymentSource,
          revenuecat_app_user_id: appUserId,
          current_period_end: expirationMs ? new Date(expirationMs).toISOString() : null,
        }, { onConflict: 'user_id' });
        break;
      }

      case 'CANCELLATION': {
        await supabase
          .from('user_subscriptions')
          .update({ status: 'cancelled' })
          .eq('user_id', appUserId);
        break;
      }

      case 'EXPIRATION': {
        await supabase
          .from('user_subscriptions')
          .update({ tier: 'free', status: 'expired' })
          .eq('user_id', appUserId);
        break;
      }

      case 'BILLING_ISSUE': {
        await supabase
          .from('user_subscriptions')
          .update({ status: 'grace_period' })
          .eq('user_id', appUserId);
        break;
      }

      case 'PRODUCT_CHANGE': {
        // User switched plans — treat as active premium
        await supabase
          .from('user_subscriptions')
          .update({ status: 'active', tier: 'premium' })
          .eq('user_id', appUserId);
        break;
      }

      default:
        console.log(`[rc-webhook] Unhandled event type: ${eventType}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[rc-webhook] Processing error:', err);
    return new Response(JSON.stringify({ error: 'Processing failed' }), { status: 500 });
  }
});
