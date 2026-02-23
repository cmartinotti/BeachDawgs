-- ============================================================
-- BeachDawgs — Migration 002: Security, RLS & Subscriptions
-- Must run AFTER 001_initial_schema.sql
-- ============================================================

-- ============================================================
-- USER SUBSCRIPTIONS
-- ============================================================
CREATE TABLE public.user_subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier                   TEXT NOT NULL DEFAULT 'free'
                         CHECK (tier IN ('free','premium')),
  payment_source         TEXT
                         CHECK (payment_source IN ('apple','google','stripe')),
  status                 TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','cancelled','expired','grace_period')),
  current_period_end     TIMESTAMPTZ,
  stripe_customer_id     TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  revenuecat_app_user_id TEXT UNIQUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT one_subscription_per_user UNIQUE (user_id)
);

CREATE INDEX idx_subscriptions_stripe    ON public.user_subscriptions(stripe_customer_id)     WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_subscriptions_revenuecat ON public.user_subscriptions(revenuecat_app_user_id) WHERE revenuecat_app_user_id IS NOT NULL;

CREATE TRIGGER user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-create free subscription row when a new user registers
CREATE OR REPLACE FUNCTION public.create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_subscription();

-- Also auto-create user_profile skeleton on registration
CREATE OR REPLACE FUNCTION public.create_default_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, username, is_public)
  VALUES (
    NEW.id,
    -- Default username from email prefix; user must update it
    LOWER(SPLIT_PART(NEW.email, '@', 1)) || '_' || SUBSTR(NEW.id::text, 1, 4),
    true
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_profile();

-- ============================================================
-- PREMIUM ENTITLEMENT HELPER
-- Used in RLS policies and Edge Functions can query directly
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_premium(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_subscriptions
    WHERE user_id = check_user_id
      AND tier = 'premium'
      AND status IN ('active', 'grace_period')
      AND (current_period_end IS NULL OR current_period_end > now())
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- ROW-LEVEL SECURITY — enable on all tables
-- ============================================================
ALTER TABLE public.beaches              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beach_conditions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_beaches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_counters  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- BEACHES — public reference data, read-only for all auth users
-- ============================================================
CREATE POLICY "beaches_read_authenticated" ON public.beaches
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- BEACH CONDITIONS — public reference data
-- ============================================================
CREATE POLICY "beach_conditions_read_authenticated" ON public.beach_conditions
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- USER PROFILES
-- ============================================================
CREATE POLICY "profiles_select" ON public.user_profiles
  FOR SELECT USING (is_public = true OR auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_delete_own" ON public.user_profiles
  FOR DELETE USING (auth.uid() = id);

-- ============================================================
-- USER PREFERENCES
-- ============================================================
CREATE POLICY "preferences_all_own" ON public.user_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- NOTIFICATION SETTINGS
-- ============================================================
CREATE POLICY "notification_settings_all_own" ON public.notification_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- USER BEACHES (favourites)
-- ============================================================
CREATE POLICY "user_beaches_all_own" ON public.user_beaches
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- CHECK-INS
-- Owner sees all; others see only public check-ins
-- ============================================================
CREATE POLICY "checkins_select" ON public.check_ins
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "checkins_insert_own" ON public.check_ins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "checkins_update_own" ON public.check_ins
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "checkins_delete_own" ON public.check_ins
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- NOTIFICATIONS LOG — no direct user access; service_role only
-- ============================================================
CREATE POLICY "notifications_log_select_own" ON public.notifications_log
  FOR SELECT USING (auth.uid() = user_id);
-- INSERT/UPDATE/DELETE handled exclusively by Edge Functions via service_role

-- ============================================================
-- RATE LIMIT COUNTERS — no user access; service_role only
-- ============================================================
-- No policies for authenticated role; only service_role can read/write

-- ============================================================
-- USER SUBSCRIPTIONS — users can read own; only service_role writes
-- ============================================================
CREATE POLICY "subscriptions_select_own" ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE for authenticated role
-- Webhook Edge Functions use service_role key which bypasses RLS
