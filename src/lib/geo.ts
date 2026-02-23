/**
 * BeachDawgs — Geospatial Utilities
 */

export interface Coordinate {
  lat: number;
  lng: number;
}

// ─── Haversine Distance ───────────────────────────────────────────────────────
// Returns distance in metres between two lat/lng points
export function haversineMetres(a: Coordinate, b: Coordinate): number {
  const R = 6371000; // Earth radius in metres
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const c =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// ─── Bounding Box ─────────────────────────────────────────────────────────────
// Returns a lat/lng bounding box for a rough pre-filter before precise Haversine
// Useful for limiting initial Supabase query scope
export function boundingBox(
  center: Coordinate,
  radiusMetres: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = (radiusMetres / 6371000) * (180 / Math.PI);
  const lngDelta =
    (radiusMetres / (6371000 * Math.cos(toRad(center.lat)))) * (180 / Math.PI);
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}

// ─── Round Coordinates ────────────────────────────────────────────────────────
// 4 decimal places = ~11m precision — enough to confirm beach presence
// Used server-side before storing check-in coordinates
export function roundCoordinate(value: number): number {
  return Math.round(value * 10000) / 10000;
}

// ─── Bearing ─────────────────────────────────────────────────────────────────
// Returns bearing in degrees (0 = north, 90 = east) from point A to point B
export function bearingDegrees(from: Coordinate, to: Coordinate): number {
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// ─── Wind Direction Label ─────────────────────────────────────────────────────
export function windDirectionLabel(degrees: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(degrees / 22.5) % 16;
  return dirs[idx];
}

// ─── Check-in Radius Validation ──────────────────────────────────────────────
export const CHECKIN_RADIUS_METRES = 300;

export function isWithinCheckinRadius(
  user: Coordinate,
  beach: Coordinate
): { valid: boolean; distanceM: number } {
  const distanceM = Math.round(haversineMetres(user, beach));
  return { valid: distanceM <= CHECKIN_RADIUS_METRES, distanceM };
}
