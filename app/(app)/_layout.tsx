import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="beach/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="checkin/[beachId]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="profile/[username]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="settings/notifications" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="settings/preferences" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="settings/account" options={{ presentation: 'card', animation: 'slide_from_right' }} />
    </Stack>
  );
}
