import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import type { UserProfile, UserSubscription } from '../types/user';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  subscription: UserSubscription | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setSubscription: (sub: UserSubscription | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  profile: null,
  subscription: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setSubscription: (subscription) => set({ subscription }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ user: null, session: null, profile: null, subscription: null }),
}));

// Computed helpers (not in store to avoid stale closures)
export function isPremiumSubscription(sub: UserSubscription | null): boolean {
  if (!sub) return false;
  const isActiveTier = sub.tier === 'premium';
  const isActiveStatus = sub.status === 'active' || sub.status === 'grace_period';
  const notExpired = !sub.current_period_end || new Date(sub.current_period_end) > new Date();
  return isActiveTier && isActiveStatus && notExpired;
}
