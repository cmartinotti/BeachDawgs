import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import { registerForPushNotifications } from '@/lib/notifications';
import { useAuthStore } from '@/store/authStore';
import type { NotificationSettings } from '@/types/user';

export function useNotifications() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['notification-settings', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user!.id)
        .single();
      if (error) return null;
      return data as NotificationSettings;
    },
  });

  const { mutateAsync: updateSettings } = useMutation({
    mutationFn: async (updates: Partial<NotificationSettings>) => {
      const { error } = await supabase
        .from('notification_settings')
        .update(updates)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings', user?.id] });
    },
  });

  // Register push token when notifications are enabled
  async function enableNotifications() {
    const token = await registerForPushNotifications();
    if (token) {
      await updateSettings({ is_enabled: true, expo_push_token: token });
    }
    return !!token;
  }

  async function disableNotifications() {
    await updateSettings({ is_enabled: false });
  }

  // Handle foreground notifications
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);

  return {
    settings,
    isLoading,
    updateSettings,
    enableNotifications,
    disableNotifications,
  };
}
