import { NextRequest, NextResponse } from 'next/server';
import { stripe, getOrCreateStripeCustomer } from '@/lib/stripe';
import { validateSupabaseToken } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await validateSupabaseToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const customerId = await getOrCreateStripeCustomer(user.id, user.email ?? '');

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.APP_URL}/`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (e: any) {
    console.error('create-portal error:', e.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
