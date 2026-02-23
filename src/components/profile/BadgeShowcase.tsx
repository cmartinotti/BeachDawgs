import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';

interface Badge {
  id: string;
  name: string;
  description: string;
  emoji: string;
  earned_at?: string;
}

const BADGE_METADATA: Record<string, { emoji: string; name: string; description: string }> = {
  first_splash: { emoji: '🏄', name: 'First Splash', description: 'First check-in' },
  local: { emoji: '🏠', name: 'Local', description: '10 check-ins at same beach' },
  explorer: { emoji: '🗺️', name: 'Explorer', description: '10 unique beaches visited' },
  dawn_patrol: { emoji: '🌅', name: 'Dawn Patrol', description: 'Check-in before 7am' },
  golden_hour: { emoji: '✨', name: 'Golden Hour', description: 'Check-in on a green sunset day' },
  storm_chaser: { emoji: '⛈️', name: 'Storm Chaser', description: 'Check-in on a red wind day' },
  dog_walker: { emoji: '🐕', name: 'Dog Walker', description: '25 check-ins at dog-friendly beaches' },
  state_hopper: { emoji: '✈️', name: 'State Hopper', description: 'Check-ins in 3+ states' },
  centurion: { emoji: '💯', name: 'Centurion', description: '100 total check-ins' },
};

interface BadgeShowcaseProps {
  badges: Array<Badge | string>;
  maxDisplay?: number;
}

export function BadgeShowcase({ badges, maxDisplay }: BadgeShowcaseProps) {
  if (!badges || badges.length === 0) return null;

  const badgeList = badges.map((b) => {
    if (typeof b === 'string') {
      const meta = BADGE_METADATA[b];
      return meta ? { id: b, ...meta } : null;
    }
    const meta = BADGE_METADATA[b.id];
    return { id: b.id, emoji: b.emoji ?? meta?.emoji ?? '🏆', name: b.name ?? meta?.name ?? b.id, description: b.description ?? meta?.description ?? '' };
  }).filter(Boolean) as Array<{ id: string; emoji: string; name: string; description: string }>;

  const displayed = maxDisplay ? badgeList.slice(0, maxDisplay) : badgeList;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Badges</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {displayed.map((badge) => (
          <View key={badge.id} style={styles.badge}>
            <Text style={styles.emoji}>{badge.emoji}</Text>
            <Text style={styles.name} numberOfLines={1}>{badge.name}</Text>
          </View>
        ))}
        {maxDisplay && badgeList.length > maxDisplay && (
          <View style={[styles.badge, styles.moreBadge]}>
            <Text style={styles.moreText}>+{badgeList.length - maxDisplay}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.md, marginTop: spacing.sm },
  title: { fontSize: 17, fontWeight: '700', color: colors.gray900, marginBottom: spacing.sm },
  scroll: { gap: spacing.sm, paddingRight: spacing.md },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    width: 72,
    gap: 4,
  },
  emoji: { fontSize: 28 },
  name: { fontSize: 10, fontWeight: '600', color: colors.gray700, textAlign: 'center' },
  moreBadge: { justifyContent: 'center' },
  moreText: { fontSize: 16, fontWeight: '700', color: colors.gray500 },
});
