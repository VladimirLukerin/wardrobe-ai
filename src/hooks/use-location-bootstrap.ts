import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useBodyParameters } from '@/contexts/body-parameters-context';
import {
  detectCurrentAutoLocation,
  readAutoLocationIfPermissionGranted,
} from '@/services/location';
import {
  hasAskedLocationBootstrap,
  markLocationBootstrapAsked,
} from '@/storage/location-bootstrap-storage';
import { isAutoLocationFresh } from '@/utils/is-auto-location-fresh';

export function useLocationBootstrap(enabled: boolean): void {
  const {
    isHydrated,
    locationMode,
    autoLocation,
    manualLocation,
    heightCm,
    topSize,
    bottomSize,
    shoeSize,
    fitPreference,
    weatherSensitivity,
    setBodyParameters,
  } = useBodyParameters();
  const isReady = enabled && isHydrated;
  const bootstrapStartedRef = useRef(false);
  const refreshInFlightRef = useRef(false);

  const refreshAutoLocation = useCallback(
    async (requestPermission: boolean) => {
      if (refreshInFlightRef.current) {
        return;
      }

      if (locationMode === 'manual') {
        return;
      }

      if (!requestPermission && autoLocation && isAutoLocationFresh(autoLocation)) {
        return;
      }

      refreshInFlightRef.current = true;

      try {
        const outcome = requestPermission
          ? await detectCurrentAutoLocation()
          : await readAutoLocationIfPermissionGranted();

        if (outcome.status !== 'success') {
          return;
        }

        setBodyParameters({
          locationMode: 'auto',
          manualLocation,
          autoLocation: {
            ...outcome.location,
            updatedAt: Date.now(),
          },
          heightCm,
          topSize,
          bottomSize,
          shoeSize,
          fitPreference,
          weatherSensitivity,
        });
      } finally {
        refreshInFlightRef.current = false;
      }
    },
    [
      autoLocation,
      bottomSize,
      fitPreference,
      heightCm,
      locationMode,
      manualLocation,
      setBodyParameters,
      shoeSize,
      topSize,
      weatherSensitivity,
    ],
  );

  useEffect(() => {
    if (!isReady || bootstrapStartedRef.current) {
      return;
    }

    bootstrapStartedRef.current = true;

    void (async () => {
      const alreadyAsked = await hasAskedLocationBootstrap();

      if (alreadyAsked) {
        if (!isAutoLocationFresh(autoLocation)) {
          await refreshAutoLocation(false);
        }

        return;
      }

      await markLocationBootstrapAsked();
      await refreshAutoLocation(true);
    })();
  }, [autoLocation, isReady, refreshAutoLocation]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState !== 'active') {
        return;
      }

      if (isAutoLocationFresh(autoLocation)) {
        return;
      }

      void refreshAutoLocation(false);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [autoLocation, isReady, refreshAutoLocation]);
}
