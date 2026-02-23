import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { registerForPushNotifications } from '@/lib/notifications';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';

export default function OnboardingNotificationsScreen() {
  async function handleEnable() {
    const token = await registerForPushNotifications();
    if (!token) {
      Alert.alert(
        'Notifications not enabled',
        "You can enable beach alerts later in the app's notification settings.",
        [{ text: 'OK', onPress: () => router.replace('/(app)/(tabs)/') }]
      );
    } else {
      router.replace('/(app)/(tabs)/');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🔔</Text>
      <Text style={styles.title}>Never miss a perfect beach day</Text>
      <Text style={styles.body}>
        Enable notifications and we'll alert you when a nearby beach hits your preferred conditions — wind, waves, and sunsets.
        {'\n\n'}You control exactly when and how you're notified.
      </Text>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={handleEnable}>
          <Text style={styles.primaryButtonText}>Enable Notifications</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(app)/(tabs)/')}>
          <Text style={styles.skipLink}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.lg,
    paddingTop: 100,
    alignItems: 'center',
    gap: spacing.md,
  },
  emoji: { fontSize: 64 },
  title: { fontSize: 26, fontWeight: '700', color: colors.gray900, textAlign: 'center' },
  body: { fontSize: 16, color: colors.gray500, textAlign: 'center', lineHeight: 24 },
  actions: { width: '100%', gap: spacing.md, marginTop: spacing.xl },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  skipLink: { color: colors.gray400, textAlign: 'center', fontSize: 15 },
});
