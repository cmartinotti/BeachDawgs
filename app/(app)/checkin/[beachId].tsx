import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';

type CheckinState = 'idle' | 'locating' | 'verifying' | 'success' | 'error';

export default function CheckinScreen() {
  const { beachId } = useLocalSearchParams<{ beachId: string }>();
  const { user } = useAuthStore();
  const [state, setState] = useState<CheckinState>('idle');
  const [result, setResult] = useState<{
    pointsAwarded: number;
    wasRecommended: boolean;
    isFirstVisit: boolean;
    badgesEarned: string[];
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleCheckin() {
    if (!user) return;
    setState('locating');

    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location needed', 'Enable location permissions to check in at a beach.');
        setState('idle');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setState('verifying');

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/checkin-verify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session!.access_token}`,
          },
          body: JSON.stringify({
            beachId,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? 'Check-in failed');
        setState('error');
        return;
      }

      setResult({
        pointsAwarded: data.pointsAwarded,
        wasRecommended: data.wasRecommended,
        isFirstVisit: data.isFirstVisit,
        badgesEarned: data.badgesEarned ?? [],
      });
      setState('success');
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Something went wrong');
      setState('error');
    }
  }

  if (state === 'success' && result) {
    return (
      <View style={styles.container}>
        <Text style={styles.successEmoji}>🎉</Text>
        <Text style={styles.successTitle}>Checked in!</Text>
        <View style={styles.pointsCard}>
          <Text style={styles.pointsLabel}>Points earned</Text>
          <Text style={styles.pointsValue}>+{result.pointsAwarded}</Text>
          {result.wasRecommended && (
            <Text style={styles.bonusTag}>✨ Recommended beach bonus</Text>
          )}
          {result.isFirstVisit && (
            <Text style={styles.bonusTag}>🏖️ First visit bonus</Text>
          )}
        </View>
        {result.badgesEarned.length > 0 && (
          <View style={styles.badgesSection}>
            <Text style={styles.badgesTitle}>New badges earned!</Text>
            {result.badgesEarned.map((b) => (
              <Text key={b} style={styles.badgeItem}>🏅 {formatBadgeId(b)}</Text>
            ))}
          </View>
        )}
        <Pressable style={styles.doneButton} onPress={() => router.back()}>
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.closeButton} onPress={() => router.back()}>
        <Text style={styles.closeText}>✕</Text>
      </Pressable>

      <Text style={styles.emoji}>📍</Text>
      <Text style={styles.title}>Check in at this beach</Text>
      <Text style={styles.body}>
        You must be within 300m of the beach to check in.{'\n'}
        Make sure location is enabled and accurate.
      </Text>

      {state === 'error' && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {(state === 'locating' || state === 'verifying') ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>
            {state === 'locating' ? 'Getting your location…' : 'Verifying your location…'}
          </Text>
        </View>
      ) : (
        <Pressable style={styles.checkinButton} onPress={handleCheckin}>
          <Text style={styles.checkinButtonText}>Confirm Check-in</Text>
        </Pressable>
      )}
    </View>
  );
}

function formatBadgeId(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.lg,
    paddingTop: 80,
    alignItems: 'center',
    gap: spacing.md,
  },
  closeButton: { position: 'absolute', top: 55, right: spacing.md, padding: spacing.sm },
  closeText: { fontSize: 20, color: colors.gray500 },
  emoji: { fontSize: 56 },
  title: { fontSize: 24, fontWeight: '700', color: colors.gray900, textAlign: 'center' },
  body: { fontSize: 15, color: colors.gray500, textAlign: 'center', lineHeight: 22 },
  errorBox: {
    backgroundColor: colors.redBg,
    borderRadius: radius.md,
    padding: spacing.md,
    width: '100%',
  },
  errorText: { color: colors.red, fontSize: 14, textAlign: 'center' },
  loadingContainer: { alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  loadingText: { color: colors.gray500, fontSize: 15 },
  checkinButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  checkinButtonText: { color: colors.white, fontSize: 17, fontWeight: '700' },
  // Success state
  successEmoji: { fontSize: 64 },
  successTitle: { fontSize: 28, fontWeight: '800', color: colors.gray900 },
  pointsCard: {
    backgroundColor: colors.greenBg,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    width: '100%',
    gap: spacing.xs,
  },
  pointsLabel: { fontSize: 14, color: colors.gray600 },
  pointsValue: { fontSize: 48, fontWeight: '800', color: colors.green },
  bonusTag: { fontSize: 14, color: colors.green, fontWeight: '600' },
  badgesSection: { width: '100%', gap: spacing.xs },
  badgesTitle: { fontSize: 16, fontWeight: '700', color: colors.gray900 },
  badgeItem: { fontSize: 15, color: colors.gray700 },
  doneButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  doneButtonText: { color: colors.white, fontSize: 17, fontWeight: '700' },
});
