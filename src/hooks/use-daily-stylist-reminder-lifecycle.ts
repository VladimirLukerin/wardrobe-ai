import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { usePreferencesSync } from '@/contexts/preferences-sync-context';
import { useStylistPreferences } from '@/contexts/stylist-preferences-context';
import { reconcileDailyStylistReminder } from '@/services/daily-stylist-reminder';
import { getDeviceTimeZone, shouldSyncDeviceTimeZone } from '@/utils/daily-stylist-reminder-plan';

type UseDailyStylistReminderLifecycleOptions = {
  enabled: boolean;
};

export function useDailyStylistReminderLifecycle({
  enabled,
}: UseDailyStylistReminderLifecycleOptions): void {
  const {
    isHydrated,
    dailyStylistEnabled,
    dailyStylistTime,
    timezone,
    considerWeather,
    styleExperiment,
    wardrobeMode,
    avoidRepeatedOutfits,
    setStylistPreferences,
  } = useStylistPreferences();
  const { queuePreferencesSync } = usePreferencesSync();
  const reconcileInFlightRef = useRef<Promise<void> | null>(null);
  const lastSyncedTimeZoneRef = useRef<string | null>(null);

  const runReconcile = useCallback(async () => {
    if (!enabled || !isHydrated) {
      return;
    }

    if (reconcileInFlightRef.current) {
      await reconcileInFlightRef.current;
      return;
    }

    reconcileInFlightRef.current = reconcileDailyStylistReminder({
      stylistPreferences: {
        dailyStylistEnabled,
        dailyStylistTime,
        timezone,
      },
    }).then(() => undefined);

    try {
      await reconcileInFlightRef.current;
    } finally {
      reconcileInFlightRef.current = null;
    }
  }, [dailyStylistEnabled, dailyStylistTime, enabled, isHydrated, timezone]);

  const syncDeviceTimeZoneIfNeeded = useCallback(() => {
    if (!enabled || !isHydrated) {
      return;
    }

    const deviceTimeZone = getDeviceTimeZone();

    if (!deviceTimeZone || !shouldSyncDeviceTimeZone(timezone, deviceTimeZone)) {
      return;
    }

    if (lastSyncedTimeZoneRef.current === deviceTimeZone) {
      return;
    }

    lastSyncedTimeZoneRef.current = deviceTimeZone;
    setStylistPreferences({
      considerWeather,
      styleExperiment,
      wardrobeMode,
      avoidRepeatedOutfits,
      dailyStylistEnabled,
      dailyStylistTime,
      timezone: deviceTimeZone,
    });
    queuePreferencesSync();
  }, [
    avoidRepeatedOutfits,
    considerWeather,
    dailyStylistEnabled,
    dailyStylistTime,
    enabled,
    isHydrated,
    queuePreferencesSync,
    setStylistPreferences,
    styleExperiment,
    timezone,
    wardrobeMode,
  ]);

  useEffect(() => {
    syncDeviceTimeZoneIfNeeded();
    void runReconcile();
  }, [runReconcile, syncDeviceTimeZoneIfNeeded]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState !== 'active') {
        return;
      }

      syncDeviceTimeZoneIfNeeded();
      void runReconcile();
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [enabled, runReconcile, syncDeviceTimeZoneIfNeeded]);
}
