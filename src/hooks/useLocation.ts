import { useEffect } from 'react';
import * as Location from 'expo-location';
import { useLocationStore } from '@/store/locationStore';

export function useLocation() {
  const { location, permissionGranted, setLocation, setPermission } = useLocationStore();

  useEffect(() => {
    let subscriber: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      const granted = status === 'granted';
      setPermission(granted);

      if (!granted) return;

      // Get immediate position
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(current);

      // Watch for movement updates (low frequency to preserve battery)
      subscriber = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 100, timeInterval: 60_000 },
        (loc) => setLocation(loc)
      );
    })();

    return () => { subscriber?.remove(); };
  }, [setLocation, setPermission]);

  return { location, permissionGranted };
}
