import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { UserSubscription } from '@/types/user';

export function useSubscription() {
  const { user, subscription, setSubscription } = useAuthStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['subscription', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data as UserSubscription;
    },
    staleTime: 5 * 60 * 1000, // 5 min — refresh when real-time event fires
  });

  // Keep Zustand store in sync
  useEffect(() => {
    if (data) setSubscription(data);
  }, [data, setSubscription]);

  // Subscribe to Realtime changes so premium unlocks instantly after payment
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`subscription:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_subscriptions', filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['subscription', user.id] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const isPremium =
    !!subscription &&
    subscription.tier === 'premium' &&
    (subscription.status === 'active' || subscription.status === 'grace_period') &&
    (!subscription.current_period_end || new Date(subscription.current_period_end) > new Date());

  return {
    subscription: data ?? subscription,
    isPremium,
    isLoading,
  };
}
