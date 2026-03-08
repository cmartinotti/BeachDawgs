// ─── App ──────────────────────────────────────────────────────────────────────
export const APP_SCHEME = 'beachdawgs';
export const CHECKIN_RADIUS_METRES = 300;

// ─── Subscription ─────────────────────────────────────────────────────────────
export const FREE_FAVOURITES_LIMIT = 3;
export const FREE_NOTIFICATIONS_PER_DAY = 1;
export const PREMIUM_NOTIFICATIONS_PER_DAY = 5;

// ─── Gamification ─────────────────────────────────────────────────────────────
export const POINTS = {
  ONBOARDING_COMPLETE: 50,
  ADD_FAVOURITE: 5,
  CHECKIN_BASE: 20,
  CHECKIN_RECOMMENDED_BONUS: 15,
  CHECKIN_FIRST_VISIT_BONUS: 20,
  PROFILE_COMPLETE: 25,
  STREAK_5_DAYS: 100,
  UNIQUE_BEACHES_10: 150,
  CHECKINS_50: 200,
} as const;

export const BADGE_IDS = {
  FIRST_SPLASH: 'first_splash',
  LOCAL: 'local',
  EXPLORER: 'explorer',
  DAWN_PATROL: 'dawn_patrol',
  GOLDEN_HOUR: 'golden_hour',
  STORM_CHASER: 'storm_chaser',
  DOG_WALKER: 'dog_walker',
  STATE_HOPPER: 'state_hopper',
  CENTURION: 'centurion',
} as const;

// ─── Location ─────────────────────────────────────────────────────────────────
export const NEARBY_RADIUS_KM = 30;
export const NEARBY_RADIUS_METRES = NEARBY_RADIUS_KM * 1000;

// ─── Map ──────────────────────────────────────────────────────────────────────
export const MAP_INITIAL_DELTA = { latitudeDelta: 0.5, longitudeDelta: 0.5 };
export const AUSTRALIA_REGION = {
  latitude: -25.2744,
  longitude: 133.7751,
  latitudeDelta: 30,
  longitudeDelta: 30,
};

// ─── Weather ──────────────────────────────────────────────────────────────────
export const CONDITIONS_STALE_AFTER_HOURS = 3;
export const FORECAST_DAYS = 7;

// ─── Validation ───────────────────────────────────────────────────────────────
export const USERNAME_MAX_LENGTH = 30;
export const DISPLAY_NAME_MAX_LENGTH = 50;
export const BIO_MAX_LENGTH = 200;
export const CUSTOM_NOTIFICATION_MESSAGE_MAX_LENGTH = 100;
