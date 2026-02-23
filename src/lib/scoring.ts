/**
 * BeachDawgs — Condition Scoring
 *
 * Single source of truth for all green/yellow/red ratings.
 * Used by both the mobile app (UI display) and Edge Functions (stored ratings).
 * Keep this logic identical between the two locations.
 */

export type Rating = 'green' | 'yellow' | 'red';

// ─── Wind Rating ──────────────────────────────────────────────────────────────
// Based on wind speed in km/h at 10m height
export function computeWindRating(windSpeedKmh: number, gustsKmh: number): Rating {
  // Calm: ideal for swimming, kayaking, most activities
  if (windSpeedKmh <= 15 && gustsKmh <= 20) return 'green';
  // Moderate: OK for surfing, uncomfortable for casual swimmers
  if (windSpeedKmh <= 25 && gustsKmh <= 35) return 'yellow';
  // Strong: only experienced surfers/kiters, dangerous for casual beach-goers
  return 'red';
}

// ─── Wave Rating ──────────────────────────────────────────────────────────────
// Based on significant wave height in metres
export function computeWaveRating(waveHeightM: number): Rating {
  if (waveHeightM <= 0.5) return 'green';  // Calm, safe for all
  if (waveHeightM <= 1.5) return 'yellow'; // Moderate surf
  return 'red';                            // Rough, hazardous for most
}

// ─── UV Rating ────────────────────────────────────────────────────────────────
// Based on UV index (WHO scale)
export function computeUvRating(uvIndex: number): Rating {
  if (uvIndex <= 5) return 'green';  // Low–Moderate
  if (uvIndex <= 8) return 'yellow'; // High
  return 'red';                      // Very High–Extreme
}

// ─── Sunset Quality Rating ────────────────────────────────────────────────────
// Derived from cloud cover and visibility — not a direct API field
// Ideal sunset: some clouds (20–60%) for dramatic colour, good visibility
export function computeSunsetRating(
  cloudCoverPercent: number,
  visibilityM: number,
  precipitationProbability: number
): Rating {
  // Rain means no good sunset
  if (precipitationProbability > 30) return 'red';
  // Overcast sky — grey, no colour
  if (cloudCoverPercent > 80) return 'red';
  // Ideal: some clouds + good visibility
  if (cloudCoverPercent >= 20 && cloudCoverPercent <= 60 && visibilityM >= 10000) return 'green';
  // Clear sky (no clouds = less dramatic) or partially hazy
  return 'yellow';
}

// ─── Overall Beach Rating ─────────────────────────────────────────────────────
// Aggregates wind + wave into a single recommendation rating
// Sunset is shown separately as it serves a different purpose
export function computeOverallRating(
  windRating: Rating,
  waveRating: Rating,
  precipitationProbability: number
): Rating {
  // Any rain = red
  if (precipitationProbability > 50) return 'red';

  const ratings = [windRating, waveRating];

  // If any critical factor is red → overall red
  if (ratings.includes('red')) return 'red';
  // If any factor is yellow → overall yellow
  if (ratings.includes('yellow')) return 'yellow';
  return 'green';
}

// ─── Full Scoring from Raw Conditions ────────────────────────────────────────
// Used by the score-conditions Edge Function after fetching from Open-Meteo
export interface RawConditions {
  wind_speed_kmh: number;
  wind_gusts_kmh: number;
  wave_height_m: number;
  cloud_cover: number;       // percentage 0–100
  visibility_m: number;
  uv_index: number;
  precipitation_probability: number;
}

export interface ScoredRatings {
  wind_rating: Rating;
  sunset_rating: Rating;
  overall_rating: Rating;
}

export function scoreConditions(raw: RawConditions): ScoredRatings {
  const windRating = computeWindRating(raw.wind_speed_kmh, raw.wind_gusts_kmh);
  const waveRating = computeWaveRating(raw.wave_height_m);
  const sunsetRating = computeSunsetRating(
    raw.cloud_cover,
    raw.visibility_m,
    raw.precipitation_probability
  );
  const overallRating = computeOverallRating(
    windRating,
    waveRating,
    raw.precipitation_probability
  );

  return { wind_rating: windRating, sunset_rating: sunsetRating, overall_rating: overallRating };
}

// ─── Rating display helpers ───────────────────────────────────────────────────
export const RATING_COLORS: Record<Rating, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
};

export const RATING_LABELS: Record<Rating, string> = {
  green: 'Great',
  yellow: 'Fair',
  red: 'Poor',
};

export function ratingMeetsMinimum(
  actual: Rating,
  minimum: 'any' | 'yellow' | 'green'
): boolean {
  if (minimum === 'any') return true;
  if (minimum === 'yellow') return actual === 'yellow' || actual === 'green';
  return actual === 'green';
}
