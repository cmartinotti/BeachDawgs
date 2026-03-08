import { View, Text, StyleSheet, ScrollView, Switch, Pressable } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';

const ACTIVITIES = [
  { id: 'swimming', label: '🏊 Swimming' },
  { id: 'surfing', label: '🏄 Surfing' },
  { id: 'bodyboarding', label: '🌊 Bodyboarding' },
  { id: 'kayaking', label: '🚣 Kayaking' },
  { id: 'paddleboarding', label: '🏄‍♀️ Paddleboarding' },
  { id: 'fishing', label: '🎣 Fishing' },
  { id: 'snorkelling', label: '🤿 Snorkelling' },
  { id: 'beach_walking', label: '🚶 Beach Walking' },
  { id: 'photography', label: '📷 Photography' },
  { id: 'dog_walking', label: '🐕 Dog Walking' },
  { id: 'kite_surfing', label: '🪁 Kite Surfing' },
];

const BEACH_TYPES = ['surf_beach', 'calm_bay', 'rock_pool', 'estuary', 'remote', 'lake'];

export default function PreferencesScreen() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery({
    queryKey: ['user-preferences', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('user_preferences').select('*').eq('user_id', user!.id).single();
      return data;
    },
  });

  const { mutate: update } = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const { error } = await supabase.from('user_preferences').update(updates).eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['user-preferences', user?.id] }); },
  });

  function toggleActivity(id: string) {
    const current: string[] = prefs?.activities ?? [];
    const next = current.includes(id) ? current.filter((a) => a !== id) : [...current, id];
    update({ activities: next });
  }

  function setBeachType(type: string) {
    update({ preferred_beach_type: prefs?.preferred_beach_type === type ? null : type });
  }

  if (!prefs) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Beach Preferences</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activities</Text>
        <Text style={styles.sectionSubtitle}>Select everything you do at the beach</Text>
        <View style={styles.chips}>
          {ACTIVITIES.map((a) => {
            const active = (prefs.activities ?? []).includes(a.id);
            return (
              <Pressable key={a.id} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleActivity(a.id)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{a.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferred Beach Type</Text>
        <View style={styles.chips}>
          {BEACH_TYPES.map((t) => {
            const active = prefs.preferred_beach_type === t;
            return (
              <Pressable key={t} style={[styles.chip, active && styles.chipActive]} onPress={() => setBeachType(t)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.replace('_', ' ')}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Beach Features</Text>
        {[
          { key: 'prefers_patrolled', label: '🏊 Patrolled beaches only' },
          { key: 'prefers_dog_friendly', label: '🐕 Dog-friendly beaches' },
          { key: 'prefers_quiet', label: '🤫 Quieter spots' },
          { key: 'prefers_facilities', label: '🚿 Facilities (showers, toilets)' },
          { key: 'accessibility_required', label: '♿ Wheelchair accessible' },
        ].map(({ key, label }) => (
          <View key={key} style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{label}</Text>
            <Switch
              value={!!(prefs as any)[key]}
              onValueChange={(v) => update({ [key]: v })}
              trackColor={{ true: colors.primary }}
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { paddingBottom: 80 },
  heading: { fontSize: 28, fontWeight: '700', color: colors.gray900, paddingHorizontal: spacing.md, paddingTop: 60, paddingBottom: spacing.md },
  section: { paddingHorizontal: spacing.md, marginBottom: spacing.xl },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.gray900, marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: colors.gray500, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.gray50,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.ocean100 },
  chipText: { fontSize: 13, color: colors.gray700 },
  chipTextActive: { color: colors.primary, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray300,
  },
  toggleLabel: { fontSize: 15, color: colors.gray800, flex: 1 },
});
