import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
  typescript: true,
});

/** Retrieve or create a Stripe customer linked to a Supabase user ID. */
export async function getOrCreateStripeCustomer(supabaseUserId: string, email: string): Promise<string> {
  // Search for existing customer by metadata
  const existing = await stripe.customers.search({
    query: `metadata['supabase_user_id']:'${supabaseUserId}'`,
    limit: 1,
  });

  if (existing.data.length > 0) {
    return existing.data[0].id;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { supabase_user_id: supabaseUserId },
  });

  return customer.id;
}
