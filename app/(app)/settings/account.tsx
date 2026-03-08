// Subscription/purchase features stubbed out — react-native-purchases removed
// (incompatible with RN 0.81 New Architecture — will add back when compatible version released)
import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';

export default function AccountScreen() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('user_profiles').select('*').eq('id', user!.id).single();
      if (data) {
        setDisplayName(data.display_name ?? '');
        setBio(data.bio ?? '');
      }
      return data;
    },
  });

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('user_profiles')
      .update({ display_name: displayName.trim() || null, bio: bio.trim() || null })
      .eq('id', user.id);
    setSaving(false);
    if (error) Alert.alert('Error', error.message);
    else {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      Alert.alert('Saved');
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.navTitle}>Account</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <Text style={styles.label}>Display name</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your name"
          placeholderTextColor={colors.gray400}
          maxLength={50}
        />
        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
          value={bio}
          onChangeText={setBio}
          placeholder="Tell us about yourself…"
          placeholderTextColor={colors.gray400}
          maxLength={200}
          multiline
        />
        <Pressable style={styles.saveButton} onPress={saveProfile} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>Save Profile</Text>}
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>
        <Text style={styles.subNote}>
          Manage your BeachDawgs Premium subscription at manage.beachdawgs.app
        </Text>
        <Pressable style={styles.manageButton} onPress={() => Linking.openURL('https://manage.beachdawgs.app')}>
          <Text style={styles.manageButtonText}>Manage Subscription</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={styles.emailText}>{user?.email}</Text>
        <Pressable onPress={async () => { await supabase.auth.signOut(); }} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { paddingBottom: 60 },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: 55,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray300,
  },
  backText: { fontSize: 17, color: colors.primary, fontWeight: '600' },
  navTitle: { fontSize: 17, fontWeight: '700', color: colors.gray900 },
  section: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.gray900, marginBottom: spacing.sm },
  label: { fontSize: 14, color: colors.gray600, marginBottom: 4, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 15,
    color: colors.gray900,
    backgroundColor: colors.gray50,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveButtonText: { color: colors.white, fontWeight: '600', fontSize: 15 },
  subNote: { fontSize: 14, color: colors.gray500, lineHeight: 20, marginBottom: spacing.md },
  manageButton: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  manageButtonText: { color: colors.gray700, fontWeight: '600', fontSize: 15 },
  emailText: { fontSize: 14, color: colors.gray500, marginBottom: spacing.md },
  signOutButton: {
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  signOutText: { color: colors.red, fontWeight: '600', fontSize: 15 },
});
