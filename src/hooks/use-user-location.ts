import { useCallback, useRef, useState } from 'react';

import type { AutoLocation } from '@/constants/body-parameters';
import { detectCurrentAutoLocation } from '@/services/location';

export type AutoLocationStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'permission_denied'
  | 'unavailable';

export function useUserLocation() {
  const [status, setStatus] = useState<AutoLocationStatus>('idle');
  const requestIdRef = useRef(0);

  const detectLocation = useCallback(async (): Promise<AutoLocation | null> => {
    const requestId = ++requestIdRef.current;
    setStatus('loading');

    const outcome = await detectCurrentAutoLocation();

    if (requestId !== requestIdRef.current) {
      return null;
    }

    if (outcome.status === 'success') {
      setStatus('success');
      return outcome.location;
    }

    if (outcome.status === 'permission_denied') {
      setStatus('permission_denied');
      return null;
    }

    setStatus('unavailable');
    return null;
  }, []);

  const resetStatus = useCallback(() => {
    requestIdRef.current += 1;
    setStatus('idle');
  }, []);

  const syncStatusFromLocation = useCallback((location: AutoLocation | null) => {
    setStatus(location ? 'success' : 'idle');
  }, []);

  return {
    status,
    detectLocation,
    resetStatus,
    syncStatusFromLocation,
  };
}
