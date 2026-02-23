import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { boundingBox } from '@/lib/geo';
import { NEARBY_RADIUS_METRES } from '@/lib/constants';
import type { LocationObject } from 'expo-location';
import type { BeachWithConditions } from '@/types/beach';
import type { MapFilters } from '@/store/mapStore';

export function useNearbyBeaches(location: LocationObject | null, filters: MapFilters) {
  return useQuery({
    queryKey: ['nearby-beaches', location?.coords.latitude, location?.coords.longitude, filters],
    enabled: !!location,
    staleTime: 3 * 60 * 1000,
    queryFn: async () => {
      if (!location) return [];

      const { minLat, maxLat, minLng, maxLng } = boundingBox(
        { lat: location.coords.latitude, lng: location.coords.longitude },
        NEARBY_RADIUS_METRES
      );
      const now = new Date().toISOString();

      let query = supabase
        .from('beaches')
        .select(`
          *,
          beach_conditions (
            id,
            forecast_time,
            wind_speed_kmh,
            wind_direction_deg,
            wave_height_m,
            wave_period_s,
            air_temp_c,
            water_temp_c,
            uv_index,
            wind_rating,
            sunset_rating,
            overall_rating
          )
        `)
        .gte('lat', minLat)
        .lte('lat', maxLat)
        .gte('lng', minLng)
        .lte('lng', maxLng)
        .order('lat');

      if (filters.dogFriendlyOnly) query = query.eq('is_dog_friendly', true);
      if (filters.patrolledOnly) query = query.eq('is_patrolled', true);
      if (filters.beachType) query = query.eq('beach_type', filters.beachType);

      const { data, error } = await query;
      if (error) throw error;

      // Normalize: pick the most current condition entry and attach as current_conditions
      const beaches: BeachWithConditions[] = (data ?? []).map((beach: any) => {
        const conditions: any[] = beach.beach_conditions ?? [];
        // Pick the entry closest to now (most recently valid forecast)
        const current = conditions
          .filter((c) => c.forecast_time <= now)
          .sort((a, b) => b.forecast_time.localeCompare(a.forecast_time))[0]
          ?? conditions[0]
          ?? null;

        return {
          ...beach,
          current_conditions: current,
        } as BeachWithConditions;
      });

      // Filter by rating if set
      if (filters.minOverallRating) {
        const ratingOrder = { green: 3, yellow: 2, red: 1 };
        const minOrder = ratingOrder[filters.minOverallRating] ?? 0;
        return beaches.filter((b) => {
          const rating = b.current_conditions?.overall_rating as keyof typeof ratingOrder | undefined;
          return rating ? ratingOrder[rating] >= minOrder : false;
        });
      }

      return beaches;
    },
  });
}
