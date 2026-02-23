import type { Rating } from '../lib/scoring';

export type BeachType = 'surf_beach' | 'calm_bay' | 'rock_pool' | 'estuary' | 'remote' | 'lake';
export type AustralianState = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'NT' | 'ACT';

export interface BeachFacilities {
  parking?: boolean;
  toilets?: boolean;
  showers?: boolean;
  cafe?: boolean;
  lifeguard?: boolean;
}

export interface Beach {
  id: string;
  osm_id: string | null;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  state: AustralianState;
  region: string | null;
  beach_type: BeachType | null;
  is_patrolled: boolean;
  is_dog_friendly: boolean;
  is_wheelchair_accessible: boolean;
  surf_rating: number | null;
  facilities: BeachFacilities;
  is_hub_location: boolean;
  hub_beach_id: string | null;
  description: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

export interface BeachWithConditions extends Beach {
  current_conditions?: BeachConditions | null;
}

export interface BeachConditions {
  id: string;
  beach_id: string;
  forecast_time: string;
  fetched_at: string;

  wind_speed_kmh: number | null;
  wind_direction_deg: number | null;
  wind_gusts_kmh: number | null;

  wave_height_m: number | null;
  wave_period_s: number | null;
  wave_direction_deg: number | null;
  swell_height_m: number | null;
  swell_period_s: number | null;

  water_temp_c: number | null;
  air_temp_c: number | null;
  uv_index: number | null;
  precipitation_probability: number | null;
  cloud_cover: number | null;
  visibility_m: number | null;

  sunrise: string | null;
  sunset: string | null;

  wind_rating: Rating | null;
  sunset_rating: Rating | null;
  overall_rating: Rating | null;
}
