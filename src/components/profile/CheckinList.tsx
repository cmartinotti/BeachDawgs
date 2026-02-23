import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';
import { format, parseISO } from 'date-fns';

interface CheckinListProps {
  userId: string;
  limit?: number;
  publicOnly?: boolean;
}

export function CheckinList({ userId, limit = 10, publicOnly = false }: CheckinListProps) {
  const { data: checkins, isLoading } = useQuery({
    queryKey: ['checkins', userId, limit, publicOnly],
    queryFn: async () => {
      let query = supabase
        .from('check_ins')
        .select('id, checked_in_at, points_awarded, beach:beaches(name, state)')
        .eq('user_id', userId)
        .order('checked_in_at', { ascending: false })
        .limit(limit);

      if (publicOnly) {
        query = query.eq('is_public', true);
      }

      const { data, error } = await query;
      if (error) return [];
      return data;
    },
  });

  if (isLoading) {
    return <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />;
  }

  if (!checkins || checkins.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>🏖️</Text>
        <Text style={styles.emptyText}>No check-ins yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {checkins.map((checkin) => {
        const beach = checkin.beach as { name: string; state: string } | null;
        return (
          <View key={checkin.id} style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.beachName}>{beach?.name ?? 'Unknown Beach'}</Text>
              <Text style={styles.date}>
                {format(parseISO(checkin.checked_in_at), 'EEE d MMM yyyy')}
                {beach?.state ? ` · ${beach.state}` : ''}
              </Text>
            </View>
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsText}>+{checkin.points_awarded ?? 0}</Text>
              <Text style={styles.pointsLabel}>pts</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyEmoji: { fontSize: 32 },
  emptyText: { fontSize: 14, color: colors.gray400 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  rowLeft: { flex: 1 },
  beachName: { fontSize: 14, fontWeight: '600', color: colors.gray900 },
  date: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  pointsBadge: {
    backgroundColor: colors.ocean100,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignItems: 'center',
    minWidth: 44,
  },
  pointsText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  pointsLabel: { fontSize: 10, color: colors.primary, marginTop: -2 },
});
