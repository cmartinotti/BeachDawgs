import { View, Text, StyleSheet } from 'react-native';
import { RATING_COLORS, RATING_LABELS, type Rating } from '@/lib/scoring';
import { radius } from '@/styles/spacing';

interface RatingBadgeProps {
  rating: Rating;
  large?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function RatingBadge({ rating, large, size = 'md' }: RatingBadgeProps) {
  const effectiveSize = large ? 'lg' : size;
  return (
    <View style={[styles.badge, styles[effectiveSize], { backgroundColor: RATING_COLORS[rating] + '20', borderColor: RATING_COLORS[rating] }]}>
      <View style={[styles.dot, { backgroundColor: RATING_COLORS[rating] }]} />
      <Text style={[styles.text, textSizes[effectiveSize], { color: RATING_COLORS[rating] }]}>
        {RATING_LABELS[rating]}
      </Text>
    </View>
  );
}

const textSizes = {
  sm: { fontSize: 11 },
  md: { fontSize: 13 },
  lg: { fontSize: 15 },
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    gap: 4,
  },
  sm: { paddingHorizontal: 7, paddingVertical: 2 },
  md: { paddingHorizontal: 10, paddingVertical: 4 },
  lg: { paddingHorizontal: 14, paddingVertical: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontWeight: '700' },
});
