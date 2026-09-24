import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, type AppStateStatus } from 'react-native';

import type { BodyParameters } from '@/constants/body-parameters';
import { useBodyParameters } from '@/contexts/body-parameters-context';
import {
  detectCurrentAutoLocation,
  readAutoLocationIfPermissionGranted,
} from '@/services/location';
import { getActiveLocation } from '@/utils/get-active-location';
import {
  getForegroundLocationPermission,
  shouldOpenLocationSettings,
} from '@/utils/location-permission';

export type HomeLocationPresentationPhase =
  | 'initializing'
  | 'detecting'
  | 'ready'
  | 'need_permission'
  | 'location_unavailable';

type SyncOptions = {
  tryResolveLocation?: boolean;
};

export function useHomeLocationPresentation() {
  const bodyParameters = useBodyParameters();
  const {
    isHydrated,
    locationMode,
    manualLocation,
    autoLocation,
    setBodyParameters,
    heightCm,
    topSize,
    bottomSize,
    shoeSize,
    fitPreference,
    weatherSensitivity,
  } = bodyParameters;

  const [phase, setPhase] = useState<HomeLocationPresentationPhase>('initializing');
  const syncGenerationRef = useRef(0);
  const resolveInFlightRef = useRef(false);

  const activeLocation = useMemo(
    () => getActiveLocation({ locationMode, manualLocation, autoLocation }),
    [autoLocation, locationMode, manualLocation],
  );

  const applyAutoLocation = useCallback(
    (location: NonNullable<BodyParameters['autoLocation']>) => {
      setBodyParameters({
        locationMode: 'auto',
        manualLocation,
        autoLocation: {
          ...location,
          updatedAt: Date.now(),
        },
        heightCm,
        topSize,
        bottomSize,
        shoeSize,
        fitPreference,
        weatherSensitivity,
      });
    },
    [
      bottomSize,
      fitPreference,
      heightCm,
      manualLocation,
      setBodyParameters,
      shoeSize,
      topSize,
      weatherSensitivity,
    ],
  );

  const syncPresentation = useCallback(
    async (options: SyncOptions = {}) => {
      if (!isHydrated) {
        return;
      }

      const generation = ++syncGenerationRef.current;

      if (locationMode === 'manual') {
        setPhase('ready');
        return;
      }

      const permission = await getForegroundLocationPermission();

      if (generation !== syncGenerationRef.current) {
        return;
      }

      if (permission.granted && activeLocation) {
        setPhase('ready');
        return;
      }

      if (!permission.granted) {
        setPhase('need_permission');
        return;
      }

      if (!options.tryResolveLocation) {
        setPhase(activeLocation ? 'ready' : 'location_unavailable');
        return;
      }

      if (resolveInFlightRef.current) {
        return;
      }

      resolveInFlightRef.current = true;
      setPhase('detecting');

      try {
        const outcome = await readAutoLocationIfPermissionGranted();

        if (generation !== syncGenerationRef.current) {
          return;
        }

        if (outcome.status === 'success') {
          applyAutoLocation(outcome.location);
          setPhase('ready');
          return;
        }

        if (outcome.status === 'permission_denied') {
          setPhase('need_permission');
          return;
        }

        setPhase('location_unavailable');
      } finally {
        resolveInFlightRef.current = false;
      }
    },
    [activeLocation, applyAutoLocation, isHydrated, locationMode],
  );

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void syncPresentation({ tryResolveLocation: true });
  }, [isHydrated, locationMode, syncPresentation]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState !== 'active') {
        return;
      }

      void syncPresentation({ tryResolveLocation: true });
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isHydrated, syncPresentation]);

  const requestLocationAccess = useCallback(async () => {
    if (!isHydrated || locationMode === 'manual') {
      return;
    }

    const generation = ++syncGenerationRef.current;
    const permission = await getForegroundLocationPermission();

    if (shouldOpenLocationSettings(permission)) {
      void Linking.openSettings();
      return;
    }

    if (resolveInFlightRef.current) {
      return;
    }

    resolveInFlightRef.current = true;
    setPhase('detecting');

    try {
      const outcome = await detectCurrentAutoLocation();

      if (generation !== syncGenerationRef.current) {
        return;
      }

      if (outcome.status === 'success') {
        applyAutoLocation(outcome.location);
        setPhase('ready');
        return;
      }

      if (outcome.status === 'permission_denied') {
        setPhase('need_permission');
        return;
      }

      setPhase('location_unavailable');
    } finally {
      resolveInFlightRef.current = false;
    }
  }, [applyAutoLocation, isHydrated, locationMode]);

  const displayLocationName =
    locationMode === 'manual' || phase === 'ready'
      ? (activeLocation?.name ?? null)
      : null;

  const isDetectingLocation = phase === 'detecting';

  return {
    phase,
    displayLocationName,
    isDetectingLocation,
    requestLocationAccess,
    retryAutoLocation: () => {
      void syncPresentation({ tryResolveLocation: true });
    },
  };
}
