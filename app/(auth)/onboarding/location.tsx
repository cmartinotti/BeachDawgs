import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useLocationStore } from '@/store/locationStore';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';

export default function OnboardingLocationScreen() {
  const { setPermissionGranted } = useLocationStore();

  async function requestLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setPermissionGranted(true);
    } else {
      Alert.alert(
        'Location needed',
        'BeachDawgs needs your location to find nearby beaches. You can enable it later in Settings.',
        [{ text: 'OK' }]
      );
    }
    router.push('/(auth)/onboarding/preferences');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>📍</Text>
      <Text style={styles.title}>Find beaches near you</Text>
      <Text style={styles.body}>
        BeachDawgs uses your location to show nearby beaches on the map and verify your beach check-ins.
        {'\n\n'}Your location is only used while the app is open.
      </Text>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={requestLocation}>
          <Text style={styles.primaryButtonText}>Enable Location</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/(auth)/onboarding/preferences')}>
          <Text style={styles.skipLink}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
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
