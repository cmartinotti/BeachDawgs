import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useLocationStore } from '@/store/locationStore';

export type CheckinStatus = 'idle' | 'locating' | 'verifying' | 'success' | 'error';

export interface CheckinResult {
  checkinId: string;
  pointsAwarded: number;
  isFirstVisit: boolean;
  wasRecommended: boolean;
  badgesEarned: string[];
  distanceM: number;
}

export interface CheckinError {
  code: 'no_location' | 'too_far' | 'already_checked_in' | 'rate_limited' | 'network' | 'unknown';
  message: string;
}

export function useCheckin() {
  const { session } = useAuthStore();
  const { location } = useLocationStore();
  const [status, setStatus] = useState<CheckinStatus>('idle');
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [error, setError] = useState<CheckinError | null>(null);

  async function checkin(beachId: string) {
    if (!session) {
      setError({ code: 'no_location', message: 'Not authenticated' });
      return;
    }

    setStatus('locating');
    setError(null);
    setResult(null);

    const coords = location?.coords;
    if (!coords) {
      setStatus('error');
      setError({ code: 'no_location', message: 'Could not get your location. Please enable location services.' });
      return;
    }

    setStatus('verifying');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('checkin-verify', {
        body: { beachId, lat: coords.latitude, lng: coords.longitude },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (fnError) throw fnError;

      if (!data?.success) {
        const msg: string = data?.error ?? 'Check-in failed';
        let code: CheckinError['code'] = 'unknown';
        if (msg.includes('far')) code = 'too_far';
        else if (msg.includes('already')) code = 'already_checked_in';
        else if (msg.includes('rate')) code = 'rate_limited';
        setStatus('error');
        setError({ code, message: msg });
        return;
      }

      setResult({
        checkinId: data.checkinId,
        pointsAwarded: data.pointsAwarded,
        isFirstVisit: data.isFirstVisit,
        wasRecommended: data.wasRecommended,
        badgesEarned: data.badgesEarned ?? [],
        distanceM: data.distanceM,
      });
      setStatus('success');
    } catch (e: any) {
      setStatus('error');
      setError({ code: 'network', message: e?.message ?? 'Network error. Please try again.' });
    }
  }

  function reset() {
    setStatus('idle');
    setResult(null);
    setError(null);
  }

  return { status, result, error, checkin, reset };
}
