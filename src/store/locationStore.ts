import { create } from 'zustand';
import type { LocationObject } from 'expo-location';

interface LocationState {
  location: LocationObject | null;
  permissionGranted: boolean;
  setLocation: (location: LocationObject | null) => void;
  setPermissionGranted: (granted: boolean) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  location: null,
  permissionGranted: false,
  setLocation: (location) => set({ location }),
  setPermissionGranted: (permissionGranted) => set({ permissionGranted }),
}));
