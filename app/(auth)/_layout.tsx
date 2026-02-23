import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="onboarding/location" />
      <Stack.Screen name="onboarding/preferences" />
      <Stack.Screen name="onboarding/notifications" />
    </Stack>
  );
}
