import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';

const ACTIVITIES = [
  { id: 'swimming', label: '🏊 Swimming' },
  { id: 'surfing', label: '🏄 Surfing' },
  { id: 'bodyboarding', label: '🌊 Bodyboarding' },
  { id: 'kayaking', label: '🚣 Kayaking' },
  { id: 'paddleboarding', label: '🏄 Paddleboarding' },
  { id: 'fishing', label: '🎣 Fishing' },
  { id: 'snorkelling', label: '🤿 Snorkelling' },
  { id: 'beach_walking', label: '🚶 Beach Walking' },
  { id: 'photography', label: '📷 Photography' },
  { id: 'dog_walking', label: '🐕 Dog Walking' },
];

export default function OnboardingPreferencesScreen() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [skillLevel, setSkillLevel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleActivity(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleContinue() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('user_preferences').upsert({
        user_id: user.id,
        activities: Array.from(selected),
        skill_level: skillLevel,
      }, { onConflict: 'user_id' });
    }
    setSaving(false);
    router.push('/(auth)/onboarding/notifications');
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>What do you love at the beach?</Text>
      <Text style={styles.subtitle}>We'll personalise your beach recommendations</Text>

      <Text style={styles.sectionLabel}>Activities</Text>
      <View style={styles.chipGrid}>
        {ACTIVITIES.map((a) => (
          <Pressable
            key={a.id}
            style={[styles.chip, selected.has(a.id) && styles.chipSelected]}
            onPress={() => toggleActivity(a.id)}
          >
            <Text style={[styles.chipText, selected.has(a.id) && styles.chipTextSelected]}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Water skill level</Text>
      <View style={styles.skillRow}>
        {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
          <Pressable
            key={level}
            style={[styles.skillChip, skillLevel === level && styles.chipSelected]}
            onPress={() => setSkillLevel(level)}
          >
            <Text style={[styles.chipText, skillLevel === level && styles.chipTextSelected]}>
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.primaryButton} onPress={handleContinue} disabled={saving}>
        <Text style={styles.primaryButtonText}>Continue</Text>
      </Pressable>

      <Pressable onPress={() => router.push('/(auth)/onboarding/notifications')}>
        <Text style={styles.skipLink}>Skip for now</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: 70,
    backgroundColor: colors.white,
    gap: spacing.md,
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.gray900 },
  subtitle: { fontSize: 15, color: colors.gray500 },
  sectionLabel: { fontSize: 16, fontWeight: '600', color: colors.gray700, marginTop: spacing.sm },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  skillRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.gray50,
  },
  skillChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.gray50,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, color: colors.gray700 },
  chipTextSelected: { color: colors.white, fontWeight: '600' },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  skipLink: { color: colors.gray400, textAlign: 'center', fontSize: 15 },
});
