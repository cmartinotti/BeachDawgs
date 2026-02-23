import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { BadgeShowcase } from '@/components/profile/BadgeShowcase';
import { StatCard } from '@/components/profile/StatCard';
import { CheckinList } from '@/components/profile/CheckinList';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';

export default function PublicProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['public-profile', username],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('username', username)
        .eq('is_public', true)
        .single();
      if (error) return null;
      return data;
    },
  });

  if (isLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 100 }} />;

  if (!profile) {
    return (
      <View style={styles.notFound}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.notFoundEmoji}>🤷</Text>
        <Text style={styles.notFoundText}>Profile not found or private</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.navTitle}>@{profile.username}</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.header}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {(profile.display_name ?? profile.username)?.[0]?.toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.displayName}>{profile.display_name ?? profile.username}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        {profile.home_state && <Text style={styles.homeState}>📍 {profile.home_state}</Text>}
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Points" value={profile.total_points} emoji="⚡" />
        <StatCard label="Check-ins" value={profile.checkin_count} emoji="📍" />
        <StatCard label="Beaches" value={profile.unique_beaches_count} emoji="🏖️" />
      </View>

      <BadgeShowcase badges={profile.badges as any[]} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Check-ins</Text>
        <CheckinList userId={profile.id} limit={5} publicOnly />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingBottom: 60 },
  notFound: { flex: 1, alignItems: 'center', paddingTop: 100, gap: spacing.md },
  backButton: { position: 'absolute', top: 55, left: spacing.md },
  backText: { fontSize: 17, color: colors.primary, fontWeight: '600' },
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
  navTitle: { fontSize: 17, fontWeight: '700', color: colors.gray900 },
  notFoundEmoji: { fontSize: 48 },
  notFoundText: { fontSize: 18, color: colors.gray500 },
  header: { alignItems: 'center', paddingTop: spacing.xl, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  avatar: { width: 88, height: 88, borderRadius: 44, marginBottom: spacing.md },
  avatarPlaceholder: { backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 36, fontWeight: '700', color: colors.white },
  displayName: { fontSize: 22, fontWeight: '700', color: colors.gray900 },
  username: { fontSize: 15, color: colors.gray500, marginTop: 2 },
  bio: { fontSize: 14, color: colors.gray600, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  homeState: { fontSize: 14, color: colors.gray500, marginTop: spacing.xs },
  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.sm },
  section: { paddingHorizontal: spacing.md, marginTop: spacing.md },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.gray900, marginBottom: spacing.sm },
});
