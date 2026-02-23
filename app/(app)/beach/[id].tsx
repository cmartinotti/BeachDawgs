import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { ConditionsRow } from '@/components/beach/ConditionsRow';
import { ForecastDay } from '@/components/beach/ForecastDay';
import { RatingBadge } from '@/components/beach/RatingBadge';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';
import { FREE_FAVOURITES_LIMIT } from '@/lib/constants';
import { isPremiumSubscription } from '@/store/authStore';
import { format, parseISO, isSameDay } from 'date-fns';

export default function BeachDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, subscription } = useAuthStore();
  const queryClient = useQueryClient();
  const isPremium = isPremiumSubscription(subscription);
  const [selectedDay, setSelectedDay] = useState(0);

  const { data: beach, isLoading } = useQuery({
    queryKey: ['beach', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beaches')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: conditions = [] } = useQuery({
    queryKey: ['conditions', id],
    enabled: !!beach,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beach_conditions')
        .select('*')
        .eq('beach_id', id)
        .gte('forecast_time', new Date().toISOString())
        .order('forecast_time', { ascending: true })
        .limit(isPremium ? 168 : 48); // Premium: 7-day hourly, Free: 2-day
      if (error) throw error;
      return data;
    },
  });

  const { data: isFavourite } = useQuery({
    queryKey: ['favourite', id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('user_beaches')
        .select('id')
        .eq('user_id', user!.id)
        .eq('beach_id', id)
        .maybeSingle();
      return !!data;
    },
  });

  const toggleFavourite = useMutation({
    mutationFn: async () => {
      if (isFavourite) {
        await supabase.from('user_beaches').delete().eq('user_id', user!.id).eq('beach_id', id);
      } else {
        // Check favourite limit for free tier
        if (!isPremium) {
          const { count } = await supabase
            .from('user_beaches')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user!.id);
          if ((count ?? 0) >= FREE_FAVOURITES_LIMIT) {
            throw new Error(`Free plan allows up to ${FREE_FAVOURITES_LIMIT} favourite beaches. Upgrade to Premium for unlimited.`);
          }
        }
        await supabase.from('user_beaches').insert({ user_id: user!.id, beach_id: id });
      }
    },
    onError: (e: any) => Alert.alert('Error', e.message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favourite', id] });
      queryClient.invalidateQueries({ queryKey: ['favourites'] });
    },
  });

  // Group conditions by day
  const dailyGroups = conditions.reduce<Record<string, typeof conditions>>((acc, c) => {
    const day = c.forecast_time.substring(0, 10);
    if (!acc[day]) acc[day] = [];
    acc[day].push(c);
    return acc;
  }, {});

  const days = Object.keys(dailyGroups).slice(0, isPremium ? 7 : 2);
  const currentDayConditions = days[selectedDay] ? dailyGroups[days[selectedDay]] : [];
  const currentConditions = currentDayConditions?.[0];

  if (isLoading || !beach) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} stickyHeaderIndices={[0]}>
      {/* Back header */}
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Pressable onPress={() => toggleFavourite.mutate()}>
          <Text style={styles.favouriteIcon}>{isFavourite ? '⭐' : '☆'}</Text>
        </Pressable>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        {beach.thumbnail_url ? (
          <Image source={{ uri: beach.thumbnail_url }} style={styles.heroImage} />
        ) : (
          <View style={[styles.heroImage, styles.heroPlaceholder]}>
            <Text style={styles.heroEmoji}>🏖️</Text>
          </View>
        )}
        <View style={styles.heroOverlay}>
          <Text style={styles.beachName}>{beach.name}</Text>
          <Text style={styles.beachLocation}>
            {beach.region ? `${beach.region}, ` : ''}{beach.state}
          </Text>
          <View style={styles.heroTags}>
            {beach.is_patrolled && <View style={styles.tag}><Text style={styles.tagText}>Patrolled</Text></View>}
            {beach.is_dog_friendly && <View style={styles.tag}><Text style={styles.tagText}>Dog friendly 🐕</Text></View>}
            {beach.is_wheelchair_accessible && <View style={styles.tag}><Text style={styles.tagText}>Accessible</Text></View>}
          </View>
        </View>
      </View>

      {/* Current conditions */}
      {currentConditions && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Right now</Text>
            {currentConditions.overall_rating && (
              <RatingBadge rating={currentConditions.overall_rating} large />
            )}
          </View>
          <ConditionsRow conditions={currentConditions} />
        </View>
      )}

      {/* 7-day / 2-day forecast */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{isPremium ? '7-day Forecast' : '2-day Forecast'}</Text>
          {!isPremium && (
            <Pressable onPress={() => router.push('/settings/account')}>
              <Text style={styles.premiumBadge}>Upgrade for 7 days →</Text>
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayPicker}>
          {days.map((day, idx) => (
            <ForecastDay
              key={day}
              date={day}
              conditions={dailyGroups[day]}
              isSelected={selectedDay === idx}
              onPress={() => setSelectedDay(idx)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Hourly for selected day (premium) */}
      {isPremium && currentDayConditions.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hourly — {format(parseISO(days[selectedDay]), 'EEE d MMM')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
            {currentDayConditions.map((c) => (
              <View key={c.forecast_time} style={styles.hourlySlot}>
                <Text style={styles.hourlyTime}>{format(parseISO(c.forecast_time), 'ha')}</Text>
                <RatingBadge rating={c.overall_rating} size="sm" />
                <Text style={styles.hourlyWind}>{c.wind_speed_kmh?.toFixed(0)} km/h</Text>
                <Text style={styles.hourlyWave}>{c.wave_height_m?.toFixed(1)}m</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Check-in button */}
      <View style={styles.checkinSection}>
        <Pressable
          style={styles.checkinButton}
          onPress={() => router.push(`/checkin/${id}`)}
        >
          <Text style={styles.checkinButtonText}>📍 I'm here — Check In</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingTop: 55,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  backButton: { padding: spacing.xs },
  backText: { fontSize: 17, color: colors.primary, fontWeight: '600' },
  favouriteIcon: { fontSize: 26 },
  hero: { height: 200, position: 'relative' },
  heroImage: { width: '100%', height: 200 },
  heroPlaceholder: { backgroundColor: colors.ocean100, justifyContent: 'center', alignItems: 'center' },
  heroEmoji: { fontSize: 56 },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  beachName: { fontSize: 24, fontWeight: '800', color: colors.white },
  beachLocation: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  heroTags: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  tag: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { color: colors.white, fontSize: 11, fontWeight: '600' },
  section: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.gray900 },
  premiumBadge: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  dayPicker: { marginTop: spacing.xs },
  hourlySlot: {
    alignItems: 'center',
    marginRight: spacing.md,
    gap: 4,
    minWidth: 52,
  },
  hourlyTime: { fontSize: 12, color: colors.gray500, fontWeight: '600' },
  hourlyWind: { fontSize: 11, color: colors.gray600 },
  hourlyWave: { fontSize: 11, color: colors.gray600 },
  checkinSection: { padding: spacing.lg },
  checkinButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  checkinButtonText: { color: colors.white, fontSize: 17, fontWeight: '700' },
});
