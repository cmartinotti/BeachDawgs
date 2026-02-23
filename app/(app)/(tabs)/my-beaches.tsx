import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { RatingBadge } from '@/components/beach/RatingBadge';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';

export default function MyBeachesScreen() {
  const { user } = useAuthStore();

  const { data: favourites = [], isLoading } = useQuery({
    queryKey: ['favourites', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_beaches')
        .select(`
          beach_id,
          beaches(
            id, name, state, region, is_patrolled, is_dog_friendly,
            beach_conditions(overall_rating, wind_speed_kmh, wave_height_m, air_temp_c)
          )
        `)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data?.map((f) => f.beaches) ?? [];
    },
  });

  if (!user) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Beaches</Text>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : favourites.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>⭐</Text>
          <Text style={styles.emptyTitle}>No favourite beaches yet</Text>
          <Text style={styles.emptyBody}>
            Tap the star on any beach to save it here for quick access.
          </Text>
          <Pressable style={styles.exploreButton} onPress={() => router.push('/(app)/(tabs)/explore')}>
            <Text style={styles.exploreButtonText}>Explore Beaches</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={favourites}
          keyExtractor={(b: any) => b.id}
          renderItem={({ item: beach }: any) => {
            const cond = beach.beach_conditions?.[0];
            return (
              <Pressable style={styles.beachRow} onPress={() => router.push(`/beach/${beach.id}`)}>
                <View style={styles.beachInfo}>
                  <Text style={styles.beachName}>{beach.name}</Text>
                  <Text style={styles.beachMeta}>
                    {beach.state}{beach.region ? ` · ${beach.region}` : ''}
                    {cond?.air_temp_c ? ` · ${Math.round(cond.air_temp_c)}°C` : ''}
                  </Text>
                  {cond && (
                    <Text style={styles.condsMeta}>
                      💨 {cond.wind_speed_kmh?.toFixed(0)} km/h  🌊 {cond.wave_height_m?.toFixed(1)}m
                    </Text>
                  )}
                </View>
                {cond?.overall_rating && <RatingBadge rating={cond.overall_rating} />}
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 60 },
  header: { fontSize: 26, fontWeight: '700', color: colors.gray900, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.gray800 },
  emptyBody: { fontSize: 15, color: colors.gray500, textAlign: 'center', lineHeight: 22 },
  exploreButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  exploreButtonText: { color: colors.white, fontWeight: '600', fontSize: 15 },
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
  condsMeta: { fontSize: 13, color: colors.gray600, marginTop: 3 },
  separator: { height: 1, backgroundColor: colors.gray100, marginLeft: spacing.md },
});
