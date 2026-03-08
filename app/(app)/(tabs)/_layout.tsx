import { Tabs } from 'expo-router';
import { colors } from '@/styles/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.white,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.5)',
        tabBarStyle: {
          borderTopColor: colors.primaryDark,
          backgroundColor: '#D4600A',
          paddingBottom: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => <TabIcon emoji="🗺️" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <TabIcon emoji="🔍" color={color} />,
        }}
      />
      <Tabs.Screen
        name="my-beaches"
        options={{
          title: 'My Beaches',
          tabBarIcon: ({ color }) => <TabIcon emoji="⭐" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}
