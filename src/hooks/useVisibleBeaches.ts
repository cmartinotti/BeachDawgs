import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Region } from 'react-native-maps';
import type { BeachWithConditions } from '@/types/beach';
import type { MapFilters } from '@/store/mapStore';

/**
 * Maximum latitudeDelta before we stop loading beaches.
 * 1.5° ≈ 165 km view height — beyond this the viewport is too large
 * and would pull in hundreds of beaches across multiple states.
 */
export const MAX_VISIBLE_DELTA = 1.5;

export function useVisibleBeaches(region: Region | null, filters: MapFilters) {
  const tooZoomedOut = !region || region.latitudeDelta > MAX_VISIBLE_DELTA;

  return {
    tooZoomedOut,
    ...useQuery({
      queryKey: [
        'visible-beaches',
        region?.latitude,
        region?.longitude,
        region?.latitudeDelta,
        region?.longitudeDelta,
        filters,
      ],
      enabled: !tooZoomedOut,
      staleTime: 60 * 1000, // 1 min — region changes frequently, avoid hammering DB
      queryFn: async () => {
        if (!region) return [];

        const minLat = region.latitude - region.latitudeDelta / 2;
        const maxLat = region.latitude + region.latitudeDelta / 2;
        const minLng = region.longitude - region.longitudeDelta / 2;
        const maxLng = region.longitude + region.longitudeDelta / 2;
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
          .order('lat')
          .limit(300); // safety cap — at max delta 1.5° there can be many beaches

        if (filters.dogFriendlyOnly) query = query.eq('is_dog_friendly', true);
        if (filters.patrolledOnly)   query = query.eq('is_patrolled', true);
        if (filters.beachType)       query = query.eq('beach_type', filters.beachType);

        const { data, error } = await query;
        if (error) throw error;

        // Normalise: pick the most current condition entry for each beach
        const beaches: BeachWithConditions[] = (data ?? []).map((beach: any) => {
          const conditions: any[] = beach.beach_conditions ?? [];
          const current =
            conditions
              .filter((c) => c.forecast_time <= now)
              .sort((a, b) => b.forecast_time.localeCompare(a.forecast_time))[0]
            ?? conditions[0]
            ?? null;
          return { ...beach, current_conditions: current } as BeachWithConditions;
        });

        // Rating filter (applied after normalisation so we have current_conditions)
        if (filters.minOverallRating) {
          const order = { green: 3, yellow: 2, red: 1 } as const;
          const minOrder = order[filters.minOverallRating] ?? 0;
          return beaches.filter((b) => {
            const r = b.current_conditions?.overall_rating as keyof typeof order | undefined;
            return r ? order[r] >= minOrder : false;
          });
        }

        return beaches;
      },
    }),
  };
}
