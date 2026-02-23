import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServiceSupabase } from '@/lib/supabase';
import type Stripe from 'stripe';

// Must disable body parsing so we get the raw body for signature verification
export const runtime = 'edge';

function mapStripeStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'grace_period';
    case 'canceled':
      return 'cancelled';
    default:
      return 'expired';
  }
}

async function upsertSubscription(
  supabaseUserId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  status: string,
  currentPeriodEnd: number | null,
  tier: 'free' | 'premium' = 'premium'
) {
  const supabase = createServiceSupabase();
  const { error } = await supabase.from('user_subscriptions').upsert(
    {
      user_id: supabaseUserId,
      tier,
      payment_source: 'stripe',
      status,
      current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (e: any) {
    console.error('Webhook signature verification failed:', e.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const supabaseUserId = sub.metadata?.supabase_user_id;
        if (!supabaseUserId) break;

        await upsertSubscription(
          supabaseUserId,
          sub.customer as string,
          sub.id,
          mapStripeStatus(sub.status),
          sub.current_period_end,
          'premium'
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const supabaseUserId = sub.metadata?.supabase_user_id;
        if (!supabaseUserId) break;

        await upsertSubscription(
          supabaseUserId,
          sub.customer as string,
          sub.id,
          'cancelled',
          null,
          'free'
        );
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string | null;
        if (!subscriptionId) break;

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const supabaseUserId = sub.metadata?.supabase_user_id;
        if (!supabaseUserId) break;

        await upsertSubscription(
          supabaseUserId,
          sub.customer as string,
          sub.id,
          'grace_period',
          sub.current_period_end,
          'premium'
        );
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string | null;
        if (!subscriptionId) break;

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const supabaseUserId = sub.metadata?.supabase_user_id;
        if (!supabaseUserId) break;

        await upsertSubscription(
          supabaseUserId,
          sub.customer as string,
          sub.id,
          'active',
          sub.current_period_end,
          'premium'
        );
        break;
      }

      default:
        // Unhandled event type — ignore
        break;
    }
  } catch (e: any) {
    console.error('Webhook handler error:', e.message);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
