-- ============================================================
-- BeachDawgs — Migration 001: Initial Schema
-- Run via: supabase db push
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "earthdistance" CASCADE; -- enables ll_to_earth for spatial queries
CREATE EXTENSION IF NOT EXISTS "cube";                  -- earthdistance depends on cube

-- ============================================================
-- BEACHES
-- ============================================================
CREATE TABLE public.beaches (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  osm_id                 TEXT UNIQUE,
  name                   TEXT NOT NULL,
  slug                   TEXT UNIQUE NOT NULL,
  lat                    DECIMAL(9,6) NOT NULL,
  lng                    DECIMAL(9,6) NOT NULL,
  state                  TEXT NOT NULL CHECK (state IN ('NSW','VIC','QLD','WA','SA','TAS','NT','ACT')),
  region                 TEXT,

  -- Classification
  beach_type             TEXT CHECK (beach_type IN ('surf_beach','calm_bay','rock_pool','estuary','remote','lake')),
  is_patrolled           BOOLEAN NOT NULL DEFAULT false,
  is_dog_friendly        BOOLEAN NOT NULL DEFAULT false,
  is_wheelchair_accessible BOOLEAN NOT NULL DEFAULT false,
  surf_rating            INTEGER CHECK (surf_rating BETWEEN 1 AND 5),

  -- Facilities stored as JSONB for flexibility
  -- e.g. {"parking": true, "toilets": true, "showers": false, "cafe": false, "lifeguard": true}
  facilities             JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Stormglass hub clustering
  is_hub_location        BOOLEAN NOT NULL DEFAULT false,
  hub_beach_id           UUID REFERENCES public.beaches(id),

  -- Display
  description            TEXT,
  thumbnail_url          TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Spatial index for fast radius queries
CREATE INDEX idx_beaches_location ON public.beaches
  USING gist(ll_to_earth(lat::float8, lng::float8));

CREATE INDEX idx_beaches_state ON public.beaches(state);
CREATE INDEX idx_beaches_hub   ON public.beaches(is_hub_location) WHERE is_hub_location = true;

-- ============================================================
-- BEACH CONDITIONS (cached weather data — never written by client)
-- ============================================================
CREATE TABLE public.beach_conditions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id                    UUID NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
  forecast_time               TIMESTAMPTZ NOT NULL,
  fetched_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Wind (from Open-Meteo)
  wind_speed_kmh              DECIMAL(5,1),
  wind_direction_deg          INTEGER,
  wind_gusts_kmh              DECIMAL(5,1),

  -- Waves (from Open-Meteo Marine)
  wave_height_m               DECIMAL(4,2),
  wave_period_s               DECIMAL(4,1),
  wave_direction_deg          INTEGER,
  swell_height_m              DECIMAL(4,2),
  swell_period_s              DECIMAL(4,1),

  -- Conditions
  water_temp_c                DECIMAL(4,1), -- Stormglass for hub locations
  air_temp_c                  DECIMAL(4,1),
  uv_index                    DECIMAL(3,1),
  precipitation_probability   INTEGER,
  cloud_cover                 INTEGER,      -- percentage 0–100
  visibility_m                INTEGER,

  -- Astronomical
  sunrise                     TIMESTAMPTZ,
  sunset                      TIMESTAMPTZ,

  -- Computed ratings (stored so UI never re-computes)
  wind_rating                 TEXT CHECK (wind_rating IN ('green','yellow','red')),
  sunset_rating               TEXT CHECK (sunset_rating IN ('green','yellow','red')),
  overall_rating              TEXT CHECK (overall_rating IN ('green','yellow','red')),

  UNIQUE(beach_id, forecast_time)
);

CREATE INDEX idx_conditions_beach_time   ON public.beach_conditions(beach_id, forecast_time);
CREATE INDEX idx_conditions_overall_time ON public.beach_conditions(overall_rating, forecast_time);

-- ============================================================
-- USER PROFILES (extends auth.users 1:1)
-- ============================================================
CREATE TABLE public.user_profiles (
  id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username             TEXT UNIQUE NOT NULL,
  display_name         TEXT,
  avatar_url           TEXT,
  bio                  TEXT,
  home_state           TEXT CHECK (home_state IN ('NSW','VIC','QLD','WA','SA','TAS','NT','ACT')),
  home_beach_id        UUID REFERENCES public.beaches(id),

  -- Gamification
  total_points         INTEGER NOT NULL DEFAULT 0,
  checkin_count        INTEGER NOT NULL DEFAULT 0,
  unique_beaches_count INTEGER NOT NULL DEFAULT 0,
  badges               JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Each badge: {"badge_id": "first_splash", "earned_at": "2024-01-01T00:00:00Z"}

  -- Privacy
  is_public            BOOLEAN NOT NULL DEFAULT true,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_username ON public.user_profiles(username);
CREATE INDEX idx_profiles_points   ON public.user_profiles(total_points DESC) WHERE is_public = true;

-- ============================================================
-- USER PREFERENCES
-- ============================================================
CREATE TABLE public.user_preferences (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Condition thresholds
  preferred_wind_max_kmh   INTEGER NOT NULL DEFAULT 20,
  preferred_wave_max_m     DECIMAL(3,1) NOT NULL DEFAULT 1.5,
  preferred_temp_min_c     INTEGER NOT NULL DEFAULT 20,
  preferred_uv_max         INTEGER NOT NULL DEFAULT 8,
  preferred_water_temp_min_c INTEGER NOT NULL DEFAULT 18,

  -- Activities & equipment (arrays)
  activities               TEXT[] NOT NULL DEFAULT '{}',
  skill_level              TEXT CHECK (skill_level IN ('beginner','intermediate','advanced')),
  equipment                TEXT[] NOT NULL DEFAULT '{}',

  -- Beach type preferences
  prefers_patrolled        BOOLEAN NOT NULL DEFAULT true,
  prefers_dog_friendly     BOOLEAN NOT NULL DEFAULT false,
  prefers_quiet            BOOLEAN NOT NULL DEFAULT false,
  prefers_facilities       BOOLEAN NOT NULL DEFAULT true,
  accessibility_required   BOOLEAN NOT NULL DEFAULT false,
  preferred_beach_type     TEXT CHECK (preferred_beach_type IN ('surf_beach','calm_bay','rock_pool','remote','lake')),
  max_crowd_tolerance      INTEGER CHECK (max_crowd_tolerance BETWEEN 1 AND 5),

  -- Lifestyle
  typical_visit_time       TEXT CHECK (typical_visit_time IN ('morning','midday','afternoon','sunset','varies')),
  typical_visit_duration_h INTEGER,
  visit_frequency          TEXT CHECK (visit_frequency IN ('daily','weekly','monthly','occasional')),
  travels_with             TEXT CHECK (travels_with IN ('alone','partner','family_kids','group','dog')),
  swim_confidence          TEXT CHECK (swim_confidence IN ('non_swimmer','casual','confident','strong')),
  discovery_style          TEXT CHECK (discovery_style IN ('recommended','explorer','regular')),

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id)
);

-- ============================================================
-- NOTIFICATION SETTINGS
-- ============================================================
CREATE TABLE public.notification_settings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  is_enabled                BOOLEAN NOT NULL DEFAULT true,
  expo_push_token           TEXT,

  -- Threshold criteria
  wind_max_kmh              INTEGER NOT NULL DEFAULT 20,
  wave_max_m                DECIMAL(3,1) NOT NULL DEFAULT 1.5,
  uv_max                    INTEGER NOT NULL DEFAULT 8,
  min_overall_rating        TEXT NOT NULL DEFAULT 'yellow'
                            CHECK (min_overall_rating IN ('any','yellow','green')),

  -- Timing
  notify_same_day           BOOLEAN NOT NULL DEFAULT true,
  notify_day_before         BOOLEAN NOT NULL DEFAULT false,
  notify_hour               INTEGER NOT NULL DEFAULT 8 CHECK (notify_hour BETWEEN 0 AND 23),

  -- Scope
  notify_favourites_only    BOOLEAN NOT NULL DEFAULT false,
  radius_km                 INTEGER NOT NULL DEFAULT 50,

  -- Personalisation (Premium feature — enforced in Edge Function)
  custom_message            TEXT,

  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id)
);

-- ============================================================
-- USER FAVOURITE BEACHES
-- ============================================================
CREATE TABLE public.user_beaches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beach_id   UUID NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, beach_id)
);

CREATE INDEX idx_user_beaches_user ON public.user_beaches(user_id);

-- ============================================================
-- CHECK-INS
-- ============================================================
CREATE TABLE public.check_ins (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beach_id              UUID NOT NULL REFERENCES public.beaches(id),

  -- GPS verification (coordinates rounded to 4dp server-side)
  user_lat              DECIMAL(9,6) NOT NULL,
  user_lng              DECIMAL(9,6) NOT NULL,
  distance_from_beach_m INTEGER NOT NULL,
  is_verified           BOOLEAN NOT NULL DEFAULT false,

  -- Context at time of checkin
  conditions_snapshot   JSONB,
  was_recommended       BOOLEAN NOT NULL DEFAULT false,

  -- Gamification
  points_awarded        INTEGER NOT NULL DEFAULT 0,
  badges_earned         TEXT[] NOT NULL DEFAULT '{}',
  is_first_visit        BOOLEAN NOT NULL DEFAULT false,

  -- Privacy
  is_public             BOOLEAN NOT NULL DEFAULT true,

  checked_in_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Stores the UTC date as a plain DATE for use in the unique constraint.
  -- Written explicitly by the Edge Function (checkin-verify) alongside checked_in_at.
  checked_in_date       DATE NOT NULL DEFAULT CURRENT_DATE,

  -- One checkin per beach per day per user
  UNIQUE(user_id, beach_id, checked_in_date)
);

CREATE INDEX idx_checkins_user  ON public.check_ins(user_id, checked_in_at DESC);
CREATE INDEX idx_checkins_beach ON public.check_ins(beach_id);

-- ============================================================
-- NOTIFICATIONS LOG (anti-spam)
-- ============================================================
CREATE TABLE public.notifications_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beach_id   UUID NOT NULL REFERENCES public.beaches(id),
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  for_date   DATE NOT NULL
);

CREATE INDEX idx_notif_log_user_date ON public.notifications_log(user_id, for_date);

-- ============================================================
-- RATE LIMIT COUNTERS (Edge Function anti-abuse)
-- ============================================================
CREATE TABLE public.rate_limit_counters (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_name TEXT NOT NULL,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT now(),
  count         INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, function_name, window_start)
);

CREATE INDEX idx_rate_limit_lookup ON public.rate_limit_counters(user_id, function_name, window_start);

-- ============================================================
-- ATOMIC RATE LIMIT INCREMENT (SECURITY DEFINER — safe from client)
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_rate_limit_counter(
  p_user_id      UUID,
  p_function_name TEXT,
  p_window_start TIMESTAMPTZ,
  p_max_requests INTEGER
) RETURNS TABLE(exceeded BOOLEAN) AS $$
DECLARE
  current_count INTEGER;
BEGIN
  INSERT INTO public.rate_limit_counters (user_id, function_name, window_start, count)
  VALUES (p_user_id, p_function_name, p_window_start, 1)
  ON CONFLICT (user_id, function_name, window_start)
  DO UPDATE SET count = rate_limit_counters.count + 1
  RETURNING count INTO current_count;

  RETURN QUERY SELECT current_count > p_max_requests;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
