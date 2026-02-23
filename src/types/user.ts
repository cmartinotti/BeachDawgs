import type { AustralianState } from './beach';

export type SubscriptionTier = 'free' | 'premium';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'grace_period';

export interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  home_state: AustralianState | null;
  home_beach_id: string | null;
  total_points: number;
  checkin_count: number;
  unique_beaches_count: number;
  badges: Badge[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Badge {
  badge_id: string;
  earned_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  preferred_wind_max_kmh: number;
  preferred_wave_max_m: number;
  preferred_temp_min_c: number;
  preferred_uv_max: number;
  preferred_water_temp_min_c: number;
  activities: string[];
  skill_level: 'beginner' | 'intermediate' | 'advanced' | null;
  equipment: string[];
  prefers_patrolled: boolean;
  prefers_dog_friendly: boolean;
  prefers_quiet: boolean;
  prefers_facilities: boolean;
  accessibility_required: boolean;
  preferred_beach_type: string | null;
  max_crowd_tolerance: number | null;
  typical_visit_time: string | null;
  typical_visit_duration_h: number | null;
  visit_frequency: string | null;
  travels_with: string | null;
  swim_confidence: string | null;
  discovery_style: string | null;
}

export interface NotificationSettings {
  id: string;
  user_id: string;
  is_enabled: boolean;
  expo_push_token: string | null;
  wind_max_kmh: number;
  wave_max_m: number;
  uv_max: number;
  min_overall_rating: 'any' | 'yellow' | 'green';
  notify_same_day: boolean;
  notify_day_before: boolean;
  notify_hour: number;
  notify_favourites_only: boolean;
  radius_km: number;
  custom_message: string | null;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  payment_source: 'apple' | 'google' | 'stripe' | null;
  status: SubscriptionStatus;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  revenuecat_app_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckIn {
  id: string;
  user_id: string;
  beach_id: string;
  user_lat: number;
  user_lng: number;
  distance_from_beach_m: number;
  is_verified: boolean;
  conditions_snapshot: Record<string, unknown> | null;
  was_recommended: boolean;
  points_awarded: number;
  badges_earned: string[];
  is_first_visit: boolean;
  is_public: boolean;
  checked_in_at: string;
}
