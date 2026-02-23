import { View, Text, StyleSheet, Pressable } from 'react-native';
import { RatingBadge } from '../beach/RatingBadge';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';
import type { BeachWithConditions } from '@/types/beach';

interface BeachPreviewCardProps {
  beach: BeachWithConditions;
  onPress: () => void;
  compact?: boolean;
}

export function BeachPreviewCard({ beach, onPress, compact = false }: BeachPreviewCardProps) {
  const c = beach.current_conditions;

  return (
    <Pressable style={[styles.card, compact && styles.cardCompact]} onPress={onPress}>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{beach.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {beach.state}{beach.region ? ` · ${beach.region}` : ''}
          {c?.wind_speed_kmh ? ` · 💨 ${c.wind_speed_kmh.toFixed(0)} km/h` : ''}
          {c?.wave_height_m ? ` · 🌊 ${c.wave_height_m.toFixed(1)}m` : ''}
        </Text>
      </View>
      {c?.overall_rating && <RatingBadge rating={c.overall_rating} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardCompact: {
    shadowOpacity: 0,
    elevation: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    borderRadius: 0,
    marginHorizontal: 0,
  },
  info: { flex: 1, marginRight: spacing.sm },
  name: { fontSize: 15, fontWeight: '600', color: colors.gray900 },
  meta: { fontSize: 13, color: colors.gray500, marginTop: 2 },
});
