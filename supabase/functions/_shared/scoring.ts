// Deno-compatible copy of src/lib/scoring.ts
// Keep in sync with the mobile app version

export type Rating = 'green' | 'yellow' | 'red';

export function computeWindRating(windSpeedKmh: number, gustsKmh: number): Rating {
  if (windSpeedKmh <= 15 && gustsKmh <= 20) return 'green';
  if (windSpeedKmh <= 25 && gustsKmh <= 35) return 'yellow';
  return 'red';
}

export function computeWaveRating(waveHeightM: number): Rating {
  if (waveHeightM <= 0.5) return 'green';
  if (waveHeightM <= 1.5) return 'yellow';
  return 'red';
}

export function computeSunsetRating(
  cloudCoverPercent: number,
  visibilityM: number,
  precipitationProbability: number
): Rating {
  if (precipitationProbability > 30) return 'red';
  if (cloudCoverPercent > 80) return 'red';
  if (cloudCoverPercent >= 20 && cloudCoverPercent <= 60 && visibilityM >= 10000) return 'green';
  return 'yellow';
}

export function computeOverallRating(
  windRating: Rating,
  waveRating: Rating,
  precipitationProbability: number
): Rating {
  if (precipitationProbability > 50) return 'red';
  const ratings = [windRating, waveRating];
  if (ratings.includes('red')) return 'red';
  if (ratings.includes('yellow')) return 'yellow';
  return 'green';
}

export function scoreConditions(raw: {
  wind_speed_kmh: number;
  wind_gusts_kmh: number;
  wave_height_m: number;
  cloud_cover: number;
  visibility_m: number;
  precipitation_probability: number;
}) {
  const windRating = computeWindRating(raw.wind_speed_kmh, raw.wind_gusts_kmh);
  const waveRating = computeWaveRating(raw.wave_height_m);
  const sunsetRating = computeSunsetRating(raw.cloud_cover, raw.visibility_m, raw.precipitation_probability);
  const overallRating = computeOverallRating(windRating, waveRating, raw.precipitation_probability);
  return { wind_rating: windRating, sunset_rating: sunsetRating, overall_rating: overallRating };
}

export function ratingMeetsMinimum(actual: Rating, minimum: 'any' | 'yellow' | 'green'): boolean {
  if (minimum === 'any') return true;
  if (minimum === 'yellow') return actual === 'yellow' || actual === 'green';
  return actual === 'green';
}
