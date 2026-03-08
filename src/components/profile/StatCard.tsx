import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';

interface StatCardProps {
  label: string;
  value: number | null | undefined;
  emoji: string;
}

export function StatCard({ label, value, emoji }: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.value}>{value ?? 0}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.gray200,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    gap: 2,
  },
  emoji: { fontSize: 20 },
  value: { fontSize: 22, fontWeight: '700', color: colors.gray900 },
  label: { fontSize: 11, color: colors.gray500, fontWeight: '500' },
});
