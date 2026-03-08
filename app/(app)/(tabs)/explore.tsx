import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { RatingBadge } from '@/components/beach/RatingBadge';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';
import { useLocationStore } from '@/store/locationStore';
import { useMapStore } from '@/store/mapStore';
import { boundingBox, haversineMetres } from '@/lib/geo';
import { NEARBY_RADIUS_METRES } from '@/lib/constants';
import type { BeachWithConditions } from '@/types/beach';

export default function ExploreScreen() {
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const { location } = useLocationStore();
  const { setPendingFocusBeach } = useMapStore();

  const isFiltered = search.trim().length > 1 || !!selectedState;

  const { data: beaches = [], isLoading } = useQuery({
    queryKey: ['beaches-explore', search, selectedState, location?.coords.latitude, location?.coords.longitude],
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

      // When no filters active, restrict to nearby 30km
      if (!isFiltered && location) {
        const { minLat, maxLat, minLng, maxLng } = boundingBox(
          { lat: location.coords.latitude, lng: location.coords.longitude },
          NEARBY_RADIUS_METRES
        );
        query = query
          .gte('lat', minLat).lte('lat', maxLat)
          .gte('lng', minLng).lte('lng', maxLng);
      }

      query = query.limit(80);

      const { data, error } = await query;
      if (error) throw error;

      // Haversine post-filter when showing nearby
      if (!isFiltered && location) {
        const userCoord = { lat: location.coords.latitude, lng: location.coords.longitude };
        return (data as BeachWithConditions[]).filter(
          (b) => haversineMetres(userCoord, { lat: b.lat, lng: b.lng }) <= NEARBY_RADIUS_METRES
        );
      }

      return data as BeachWithConditions[];
    },
  });

  const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

  function handleBeachPress(beach: BeachWithConditions) {
    setPendingFocusBeach({ id: beach.id, lat: beach.lat, lng: beach.lng });
    router.push('/');
  }

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

      {/* State filter — fixed-height wrapper prevents the list below from squishing chips */}
      <View style={styles.stateListContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stateRow}
        >
          {STATES.map((state) => (
            <Pressable
              key={state}
              style={[styles.stateChip, selectedState === state && styles.stateChipSelected]}
              onPress={() => setSelectedState(selectedState === state ? null : state)}
            >
              <Text style={[styles.stateChipText, selectedState === state && styles.stateChipTextSelected]}>
                {state}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          style={styles.beachList}
          data={beaches}
          keyExtractor={(b) => b.id}
          renderItem={({ item: beach }) => {
            const cond = (beach as any).beach_conditions?.[0];
            return (
              <Pressable style={styles.beachRow} onPress={() => handleBeachPress(beach)}>
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
            <Text style={styles.emptyText}>
              {!location && !isFiltered ? 'Enable location to see nearby beaches' : 'No beaches found'}
            </Text>
          }
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50, paddingTop: 60 },
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
  stateListContainer: { height: 60 },
  stateRow: { paddingHorizontal: spacing.md, gap: spacing.sm, alignItems: 'center', flexGrow: 1 },
  stateChip: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  stateChipText: { fontSize: 15, color: colors.gray600, fontWeight: '600' },
  stateChipTextSelected: { color: colors.white },
  beachList: { flex: 1 },
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
  separator: { height: 1, backgroundColor: colors.gray300, marginLeft: spacing.md },
  emptyText: { textAlign: 'center', color: colors.gray400, marginTop: spacing.xl, fontSize: 15 },
});
