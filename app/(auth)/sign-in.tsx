import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleEmailAuth() {
    if (!email || !password) {
      Alert.alert('Please enter your email and password');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        router.replace('/(auth)/onboarding/location');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace('/(app)/(tabs)');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'beachdawgs://auth/callback' },
      });
      if (error) throw error;
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Google sign-in failed');
      setLoading(false);
    }
  }

  async function handleAppleSignIn() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo: 'beachdawgs://auth/callback' },
      });
      if (error) throw error;
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Apple sign-in failed');
      setLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!email) {
      Alert.alert('Enter your email to receive a magic link');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: 'beachdawgs://auth/callback' },
      });
      if (error) throw error;
      Alert.alert('Check your email', 'We sent you a magic link to sign in.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{isSignUp ? 'Create account' : 'Welcome back'}</Text>

        {/* Social SSO — recommended primary path */}
        <Pressable style={[styles.socialButton, styles.googleButton]} onPress={handleGoogleSignIn} disabled={loading}>
          <Text style={styles.socialButtonText}>Continue with Google</Text>
        </Pressable>

        <Pressable style={[styles.socialButton, styles.appleButton]} onPress={handleAppleSignIn} disabled={loading}>
          <Text style={[styles.socialButtonText, { color: colors.white }]}>Continue with Apple</Text>
        </Pressable>

        <Text style={styles.orDivider}>or</Text>

        {/* Email + password */}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.gray400}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder="Password (min 8 characters)"
          placeholderTextColor={colors.gray400}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
        />

        <Pressable style={styles.primaryButton} onPress={handleEmailAuth} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
          )}
        </Pressable>

        <Pressable onPress={handleMagicLink} disabled={loading}>
          <Text style={styles.link}>Send magic link instead</Text>
        </Pressable>

        <Pressable onPress={() => setIsSignUp(!isSignUp)} style={{ marginTop: spacing.md }}>
          <Text style={styles.link}>
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: 80,
    backgroundColor: colors.white,
    gap: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  socialButton: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  googleButton: {
    backgroundColor: colors.white,
  },
  appleButton: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray800,
  },
  orDivider: {
    textAlign: 'center',
    color: colors.gray400,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.gray900,
    backgroundColor: colors.gray50,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  link: {
    color: colors.primary,
    textAlign: 'center',
    fontSize: 14,
  },
});
