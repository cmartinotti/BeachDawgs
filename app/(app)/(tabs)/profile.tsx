import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { BadgeShowcase } from '@/components/profile/BadgeShowcase';
import { StatCard } from '@/components/profile/StatCard';
import { CheckinList } from '@/components/profile/CheckinList';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';

export default function ProfileScreen() {
  const { user } = useAuthStore();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (!user || !profile) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {(profile.display_name ?? profile.username)?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.displayName}>{profile.display_name ?? profile.username}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        {profile.home_state && (
          <Text style={styles.homeState}>📍 {profile.home_state}</Text>
        )}

        <Pressable style={styles.editButton} onPress={() => router.push('/settings/account')}>
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </Pressable>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard label="Points" value={profile.total_points} emoji="⚡" />
        <StatCard label="Check-ins" value={profile.checkin_count} emoji="📍" />
        <StatCard label="Beaches" value={profile.unique_beaches_count} emoji="🏖️" />
      </View>

      {/* Badges */}
      <BadgeShowcase badges={profile.badges as any[]} />

      {/* Recent check-ins */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Check-ins</Text>
        <CheckinList userId={user.id} limit={5} />
      </View>

      {/* Settings */}
      <View style={styles.settingsLinks}>
        <Pressable style={styles.settingsRow} onPress={() => router.push('/settings/notifications')}>
          <Text style={styles.settingsLabel}>🔔  Notification Settings</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <Pressable style={styles.settingsRow} onPress={() => router.push('/settings/preferences')}>
          <Text style={styles.settingsLabel}>⚙️  Beach Preferences</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <Pressable style={styles.settingsRow} onPress={() => router.push('/settings/account')}>
          <Text style={styles.settingsLabel}>👤  Account & Subscription</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <Pressable
          style={[styles.settingsRow, { borderBottomWidth: 0 }]}
          onPress={async () => { await supabase.auth.signOut(); }}
        >
          <Text style={[styles.settingsLabel, { color: colors.red }]}>Sign Out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingBottom: 80 },
  header: { alignItems: 'center', paddingTop: 70, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  avatarContainer: { marginBottom: spacing.md },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarPlaceholder: { backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 36, fontWeight: '700', color: colors.white },
  displayName: { fontSize: 22, fontWeight: '700', color: colors.gray900 },
  username: { fontSize: 15, color: colors.gray500, marginTop: 2 },
  bio: { fontSize: 14, color: colors.gray600, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  homeState: { fontSize: 14, color: colors.gray500, marginTop: spacing.xs },
  editButton: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    marginTop: spacing.md,
  },
  editButtonText: { fontSize: 14, fontWeight: '600', color: colors.gray700 },
  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  section: { paddingHorizontal: spacing.md, marginTop: spacing.md },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.gray900, marginBottom: spacing.sm },
  settingsLinks: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  settingsLabel: { fontSize: 15, color: colors.gray800 },
  chevron: { fontSize: 18, color: colors.gray400 },
});
