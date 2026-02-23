import { View, Text, StyleSheet, Pressable } from 'react-native';
import { format, parseISO } from 'date-fns';
import { RATING_COLORS, type Rating } from '@/lib/scoring';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';
import type { BeachConditions } from '@/types/beach';

interface ForecastDayProps {
  date: string; // YYYY-MM-DD
  conditions: BeachConditions[];
  isSelected: boolean;
  onPress: () => void;
}

export function ForecastDay({ date, conditions, isSelected, onPress }: ForecastDayProps) {
  // Use midday conditions for the day summary
  const middayCondition = conditions.find((c) => {
    const hour = new Date(c.forecast_time).getHours();
    return hour >= 11 && hour <= 13;
  }) ?? conditions[0];

  const overall = middayCondition?.overall_rating as Rating | null;
  const windSpeed = middayCondition?.wind_speed_kmh;
  const waveHeight = middayCondition?.wave_height_m;

  const parsed = parseISO(date);
  const isToday = date === new Date().toISOString().substring(0, 10);

  return (
    <Pressable
      style={[styles.card, isSelected && styles.cardSelected, overall && { borderColor: RATING_COLORS[overall] }]}
      onPress={onPress}
    >
      <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected]}>
        {isToday ? 'Today' : format(parsed, 'EEE')}
      </Text>
      <Text style={styles.dateLabel}>{format(parsed, 'd MMM')}</Text>

      {overall && (
        <View style={[styles.ratingDot, { backgroundColor: RATING_COLORS[overall] }]} />
      )}

      {windSpeed != null && (
        <Text style={styles.condText}>💨 {windSpeed.toFixed(0)}</Text>
      )}
      {waveHeight != null && (
        <Text style={styles.condText}>🌊 {waveHeight.toFixed(1)}m</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 72,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.gray200,
    padding: spacing.sm,
    marginRight: spacing.sm,
    gap: 3,
  },
  cardSelected: {
    backgroundColor: colors.ocean100,
  },
  dayLabel: { fontSize: 13, fontWeight: '700', color: colors.gray700 },
  dayLabelSelected: { color: colors.primary },
  dateLabel: { fontSize: 11, color: colors.gray400 },
  ratingDot: { width: 10, height: 10, borderRadius: 5, marginVertical: 2 },
  condText: { fontSize: 11, color: colors.gray600 },
});
