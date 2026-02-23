import { View, Text, StyleSheet, ImageBackground, Pressable } from 'react-native';
import { router } from 'expo-router';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.emoji}>🏖️</Text>
        <Text style={styles.title}>BeachDawgs</Text>
        <Text style={styles.subtitle}>
          Find the best beaches for today.{'\n'}Rated by wind, waves & sunsets.
        </Text>
      </View>

      {/* Features */}
      <View style={styles.features}>
        {FEATURES.map((f) => (
          <View key={f.text} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/(auth)/sign-in')}>
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/(auth)/sign-in')}>
          <Text style={styles.secondaryLink}>Already have an account? Sign in</Text>
        </Pressable>
      </View>
    </View>
  );
}

const FEATURES = [
  { icon: '🗺️', text: 'Color-coded beach map — see great spots at a glance' },
  { icon: '🔔', text: 'Get notified when your favourite beach is perfect' },
  { icon: '📍', text: 'Check in and earn points for every visit' },
  { icon: '🌅', text: '7-day forecasts with wind, waves & sunset quality' },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingTop: 80,
    paddingBottom: spacing.xl,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
  },
  emoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 24,
  },
  features: {
    gap: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  featureIcon: {
    fontSize: 24,
  },
  featureText: {
    flex: 1,
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
  },
  actions: {
    gap: spacing.md,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryLink: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
  },
});
