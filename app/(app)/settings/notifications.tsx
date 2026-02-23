import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Switch, TextInput,
  Pressable, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { isPremiumSubscription } from '@/store/authStore';
import { registerForPushNotifications } from '@/lib/notifications';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';
import { PREMIUM_NOTIFICATIONS_PER_DAY, CUSTOM_NOTIFICATION_MESSAGE_MAX_LENGTH } from '@/lib/constants';

export default function NotificationSettingsScreen() {
  const { user, subscription } = useAuthStore();
  const isPremium = isPremiumSubscription(subscription);
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['notification-settings', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
  });

  const [isEnabled, setIsEnabled] = useState(true);
  const [windMax, setWindMax] = useState('20');
  const [waveMax, setWaveMax] = useState('1.5');
  const [minRating, setMinRating] = useState<'any' | 'yellow' | 'green'>('yellow');
  const [sameDay, setSameDay] = useState(true);
  const [dayBefore, setDayBefore] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [notifyHour, setNotifyHour] = useState('8');

  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.is_enabled);
      setWindMax(String(settings.wind_max_kmh));
      setWaveMax(String(settings.wave_max_m));
      setMinRating(settings.min_overall_rating as any);
      setSameDay(settings.notify_same_day);
      setDayBefore(settings.notify_day_before);
      setCustomMessage(settings.custom_message ?? '');
      setNotifyHour(String(settings.notify_hour));
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      let token = settings?.expo_push_token;
      if (isEnabled && !token) {
        token = await registerForPushNotifications() ?? undefined;
      }
      await supabase.from('notification_settings').upsert({
        user_id: user!.id,
        is_enabled: isEnabled,
        expo_push_token: token,
        wind_max_kmh: parseInt(windMax),
        wave_max_m: parseFloat(waveMax),
        min_overall_rating: minRating,
        notify_same_day: sameDay,
        notify_day_before: dayBefore,
        custom_message: isPremium ? customMessage.trim() || null : null,
        notify_hour: parseInt(notifyHour),
      }, { onConflict: 'user_id' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      Alert.alert('Saved', 'Notification settings updated.');
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  if (isLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 100 }} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Nav */}
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.navTitle}>Notifications</Text>
        <Pressable onPress={() => save.mutate()} disabled={save.isPending}>
          <Text style={[styles.saveText, save.isPending && { opacity: 0.4 }]}>Save</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Enable beach alerts</Text>
          <Switch value={isEnabled} onValueChange={setIsEnabled} trackColor={{ true: colors.primary }} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Alert conditions</Text>
        <Text style={styles.sectionSubtitle}>Notify me when a beach meets these conditions</Text>

        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Max wind speed (km/h)</Text>
          <TextInput
            style={styles.numberInput}
            value={windMax}
            onChangeText={setWindMax}
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Max wave height (m)</Text>
          <TextInput
            style={styles.numberInput}
            value={waveMax}
            onChangeText={setWaveMax}
            keyboardType="decimal-pad"
          />
        </View>

        <Text style={styles.inputLabel}>Minimum beach rating</Text>
        <View style={styles.ratingRow}>
          {(['any', 'yellow', 'green'] as const).map((r) => (
            <Pressable
              key={r}
              style={[styles.ratingChip, minRating === r && styles.ratingChipSelected]}
              onPress={() => setMinRating(r)}
            >
              <Text style={[styles.ratingChipText, minRating === r && styles.ratingChipTextSelected]}>
                {r === 'any' ? 'Any' : r === 'yellow' ? 'Fair' : 'Great'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>When to notify</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Notify on the day</Text>
          <Switch value={sameDay} onValueChange={setSameDay} trackColor={{ true: colors.primary }} />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Notify the evening before</Text>
          <Switch value={dayBefore} onValueChange={setDayBefore} trackColor={{ true: colors.primary }} />
        </View>

        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Preferred notification hour (0–23)</Text>
          <TextInput
            style={styles.numberInput}
            value={notifyHour}
            onChangeText={setNotifyHour}
            keyboardType="number-pad"
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Custom message</Text>
          {!isPremium && <Text style={styles.premiumTag}>Premium</Text>}
        </View>
        <Text style={styles.sectionSubtitle}>
          Personalise the notification text (e.g. "Hey Sarah, Bondi looks perfect!")
        </Text>
        <TextInput
          style={[styles.messageInput, !isPremium && styles.inputDisabled]}
          value={customMessage}
          onChangeText={(t) => setCustomMessage(t.slice(0, CUSTOM_NOTIFICATION_MESSAGE_MAX_LENGTH))}
          placeholder="Leave empty for default message"
          placeholderTextColor={colors.gray400}
          editable={isPremium}
          multiline
          maxLength={CUSTOM_NOTIFICATION_MESSAGE_MAX_LENGTH}
        />
        <Text style={styles.charCount}>{customMessage.length}/{CUSTOM_NOTIFICATION_MESSAGE_MAX_LENGTH}</Text>
        {!isPremium && (
          <Pressable onPress={() => router.push('/settings/account')}>
            <Text style={styles.upgradeLink}>Upgrade to Premium to personalise your message</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingBottom: 60 },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: 55,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  backText: { fontSize: 17, color: colors.primary, fontWeight: '600' },
  navTitle: { fontSize: 17, fontWeight: '700', color: colors.gray900 },
  saveText: { fontSize: 17, color: colors.primary, fontWeight: '600' },
  section: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.gray900, marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: colors.gray500, marginBottom: spacing.md },
  premiumTag: {
    backgroundColor: colors.sand100,
    color: colors.sand400,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  rowLabel: { fontSize: 15, color: colors.gray800 },
  inputRow: { marginVertical: spacing.sm },
  inputLabel: { fontSize: 14, color: colors.gray600, marginBottom: 4 },
  numberInput: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.sm,
    padding: spacing.sm,
    fontSize: 16,
    color: colors.gray900,
    width: 90,
    textAlign: 'center',
  },
  ratingRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  ratingChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  ratingChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  ratingChipText: { fontSize: 14, color: colors.gray700 },
  ratingChipTextSelected: { color: colors.white, fontWeight: '600' },
  messageInput: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.gray900,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputDisabled: { backgroundColor: colors.gray50, color: colors.gray400 },
  charCount: { fontSize: 12, color: colors.gray400, textAlign: 'right', marginTop: 4 },
  upgradeLink: { color: colors.primary, fontSize: 13, marginTop: spacing.xs },
});
