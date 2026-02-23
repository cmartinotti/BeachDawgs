import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  Pressable, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { RatingBadge } from '@/components/beach/RatingBadge';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';
import type { BeachWithConditions } from '@/types/beach';

export default function ExploreScreen() {
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const { data: beaches = [], isLoading } = useQuery({
    queryKey: ['beaches-explore', search, selectedState],
    queryFn: async () => {
      let query = supabase
        .from('beaches')
        .select(`
          *,
          beach_conditions(
            overall_rating, wind_rating, sunset_rating,
            wind_speed_kmh, wave_height_m, air_temp_c
          )
        `)
        .order('name');

      if (search.trim().length > 1) {
        query = query.ilike('name', `%${search.trim()}%`);
      }
      if (selectedState) {
        query = query.eq('state', selectedState);
      }
      query = query.limit(80);

      const { data, error } = await query;
      if (error) throw error;
      return data as BeachWithConditions[];
    },
  });

  const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Explore Beaches</Text>

      <TextInput
        style={styles.searchInput}
        placeholder="Search by beach name…"
        placeholderTextColor={colors.gray400}
        value={search}
        onChangeText={setSearch}
        clearButtonMode="while-editing"
      />

      {/* State filter */}
      <FlatList
        horizontal
        data={STATES}
        keyExtractor={(s) => s}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stateRow}
        renderItem={({ item: state }) => (
          <Pressable
            style={[styles.stateChip, selectedState === state && styles.stateChipSelected]}
            onPress={() => setSelectedState(selectedState === state ? null : state)}
          >
            <Text style={[styles.stateChipText, selectedState === state && styles.stateChipTextSelected]}>
              {state}
            </Text>
          </Pressable>
        )}
      />

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={beaches}
          keyExtractor={(b) => b.id}
          renderItem={({ item: beach }) => {
            const cond = (beach as any).beach_conditions?.[0];
            return (
              <Pressable style={styles.beachRow} onPress={() => router.push(`/beach/${beach.id}`)}>
                <View style={styles.beachInfo}>
                  <Text style={styles.beachName}>{beach.name}</Text>
                  <Text style={styles.beachMeta}>
                    {beach.state}{beach.region ? ` · ${beach.region}` : ''}
                    {beach.is_patrolled ? ' · Patrolled' : ''}
                    {beach.is_dog_friendly ? ' 🐕' : ''}
                  </Text>
                </View>
                {cond?.overall_rating && (
                  <RatingBadge rating={cond.overall_rating} />
                )}
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No beaches found</Text>
          }
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 60 },
  header: { fontSize: 26, fontWeight: '700', color: colors.gray900, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  searchInput: {
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.gray900,
    backgroundColor: colors.gray50,
  },
  stateRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  stateChip: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  stateChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  stateChipText: { fontSize: 13, color: colors.gray600, fontWeight: '600' },
  stateChipTextSelected: { color: colors.white },
  beachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    justifyContent: 'space-between',
  },
  beachInfo: { flex: 1, marginRight: spacing.md },
  beachName: { fontSize: 16, fontWeight: '600', color: colors.gray900 },
  beachMeta: { fontSize: 13, color: colors.gray500, marginTop: 2 },
  separator: { height: 1, backgroundColor: colors.gray100, marginLeft: spacing.md },
  emptyText: { textAlign: 'center', color: colors.gray400, marginTop: spacing.xl, fontSize: 15 },
});
