import { NextRequest, NextResponse } from 'next/server';
import { stripe, getOrCreateStripeCustomer } from '@/lib/stripe';
import { validateSupabaseToken } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await validateSupabaseToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { priceId, interval } = body as { priceId?: string; interval?: 'month' | 'year' };

    // Fall back to env-configured price IDs if not provided
    const resolvedPriceId =
      priceId ??
      (interval === 'year'
        ? process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID
        : process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID);

    if (!resolvedPriceId) {
      return NextResponse.json({ error: 'Missing price ID' }, { status: 400 });
    }

    const customerId = await getOrCreateStripeCustomer(user.id, user.email ?? '');

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      success_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/cancelled`,
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error('create-checkout error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
