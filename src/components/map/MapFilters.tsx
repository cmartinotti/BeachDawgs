import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useMapStore } from '@/store/mapStore';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';
import type { Rating } from '@/lib/scoring';

export function MapFiltersBar() {
  const { filters, setFilters, resetFilters } = useMapStore();
  const hasActiveFilters = filters.minOverallRating || filters.beachType || filters.dogFriendlyOnly || filters.patrolledOnly;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
      {/* Rating filter */}
      {(['green', 'yellow'] as Rating[]).map((r) => (
        <FilterChip
          key={r}
          label={r === 'green' ? '✅ Great' : '🟡 Fair+'}
          active={filters.minOverallRating === r}
          onPress={() => setFilters({ minOverallRating: filters.minOverallRating === r ? null : r })}
        />
      ))}

      <FilterChip label="🐕 Dog friendly" active={filters.dogFriendlyOnly} onPress={() => setFilters({ dogFriendlyOnly: !filters.dogFriendlyOnly })} />
      <FilterChip label="🚨 Patrolled" active={filters.patrolledOnly} onPress={() => setFilters({ patrolledOnly: !filters.patrolledOnly })} />

      {hasActiveFilters && (
        <Pressable style={styles.clearChip} onPress={resetFilters}>
          <Text style={styles.clearChipText}>✕ Clear</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { gap: spacing.xs, paddingRight: spacing.sm },
  chip: {
    backgroundColor: colors.gray200,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.gray700 },
  chipTextActive: { color: colors.white },
  clearChip: {
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  clearChipText: { fontSize: 13, fontWeight: '600', color: colors.gray500 },
});
