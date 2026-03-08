import { create } from 'zustand';
import type { Rating } from '../lib/scoring';

export interface MapFilters {
  minOverallRating: Rating | null;
  beachType: string | null;
  dogFriendlyOnly: boolean;
  patrolledOnly: boolean;
}

interface PendingFocusBeach {
  id: string;
  lat: number;
  lng: number;
}

interface MapState {
  selectedBeachId: string | null;
  filters: MapFilters;
  pendingFocusBeach: PendingFocusBeach | null;
  setSelectedBeach: (id: string | null) => void;
  setFilters: (filters: Partial<MapFilters>) => void;
  resetFilters: () => void;
  setPendingFocusBeach: (beach: PendingFocusBeach | null) => void;
}

const DEFAULT_FILTERS: MapFilters = {
  minOverallRating: null,
  beachType: null,
  dogFriendlyOnly: false,
  patrolledOnly: false,
};

export const useMapStore = create<MapState>((set) => ({
  selectedBeachId: null,
  filters: DEFAULT_FILTERS,
  pendingFocusBeach: null,
  setSelectedBeach: (selectedBeachId) => set({ selectedBeachId }),
  setFilters: (partial) => set((state) => ({ filters: { ...state.filters, ...partial } })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
  setPendingFocusBeach: (pendingFocusBeach) => set({ pendingFocusBeach }),
}));
