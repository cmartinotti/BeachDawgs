/**
 * BeachDawgs — handle-stripe-webhook Edge Function
 *
 * Receives Stripe subscription lifecycle events and keeps
 * user_subscriptions table in sync.
 *
 * Register in Stripe dashboard:
 *   Endpoint URL: https://<project>.supabase.co/functions/v1/handle-stripe-webhook
 *   Events: customer.subscription.created, customer.subscription.updated,
 *           customer.subscription.deleted, invoice.payment_failed, invoice.paid
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14?target=deno&no-check';
import { createServiceRoleClient } from '../_shared/supabase.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

  // Raw body required for signature validation — parse AFTER verification
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature!, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] Signature validation failed:', err);
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 });
  }

  const supabase = createServiceRoleClient();

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscription(supabase, sub, 'stripe');
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        await supabase
          .from('user_subscriptions')
          .update({
            tier: 'free',
            status: 'expired',
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          })
          .eq('stripe_customer_id', customerId);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await supabase
          .from('user_subscriptions')
          .update({ status: 'grace_period' })
          .eq('stripe_customer_id', invoice.customer as string);
        break;
      }

      case 'invoice.paid': {
        // Payment recovered after grace period
        const invoice = event.data.object as Stripe.Invoice;
        await supabase
          .from('user_subscriptions')
          .update({ status: 'active' })
          .eq('stripe_customer_id', invoice.customer as string);
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[stripe-webhook] Processing error:', err);
    return new Response(JSON.stringify({ error: 'Processing failed' }), { status: 500 });
  }
});

async function upsertSubscription(
  supabase: ReturnType<typeof createServiceRoleClient>,
  sub: Stripe.Subscription,
  paymentSource: 'stripe'
) {
  const customerId = sub.customer as string;
  const status = mapStripeStatus(sub.status);

  await supabase
    .from('user_subscriptions')
    .update({
      tier: status === 'active' || status === 'grace_period' ? 'premium' : 'free',
      status,
      payment_source: paymentSource,
      stripe_subscription_id: sub.id,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    })
    .eq('stripe_customer_id', customerId);
}

function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): string {
  switch (stripeStatus) {
    case 'active':
    case 'trialing': return 'active';
    case 'past_due': return 'grace_period';
    case 'canceled': return 'expired';
    case 'unpaid':   return 'expired';
    case 'incomplete': return 'free';
    default:         return 'active';
  }
}
