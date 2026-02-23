import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { BeachConditions } from '@/types/beach';

export function useBeachConditions(beachId: string | null, hoursAhead = 48) {
  return useQuery({
    queryKey: ['beach-conditions', beachId, hoursAhead],
    enabled: !!beachId,
    staleTime: 3 * 60 * 1000,
    queryFn: async () => {
      if (!beachId) return [];

      const from = new Date().toISOString();
      const to = new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('beach_conditions')
        .select('*')
        .eq('beach_id', beachId)
        .gte('forecast_time', from)
        .lte('forecast_time', to)
        .order('forecast_time', { ascending: true });

      if (error) throw error;
      return (data ?? []) as BeachConditions[];
    },
  });
}

// Groups conditions by calendar date (YYYY-MM-DD)
export function groupConditionsByDay(conditions: BeachConditions[]): Record<string, BeachConditions[]> {
  return conditions.reduce<Record<string, BeachConditions[]>>((acc, c) => {
    const day = c.forecast_time.substring(0, 10);
    if (!acc[day]) acc[day] = [];
    acc[day].push(c);
    return acc;
  }, {});
}
