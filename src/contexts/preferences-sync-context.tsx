import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAccount } from '@/contexts/account-context';
import { useAccountProfile } from '@/contexts/account-profile-context';
import { useBodyParameters } from '@/contexts/body-parameters-context';
import { useStylistPreferences } from '@/contexts/stylist-preferences-context';
import { AccountApiError } from '@/services/account';
import {
  fetchServerPreferences,
  pushLocalPreferences,
  resolvePreferencesSyncAction,
  type LocalPreferencesSnapshot,
} from '@/services/profile-sync';
import type { ServerPreferences } from '@/services/account-preferences';
import { getAuthToken } from '@/storage/auth-token-storage';
import {
  loadPreferencesSyncMetadata,
  savePreferencesSyncMetadata,
} from '@/storage/preferences-sync-storage';
import {
  getPreferencesLastSyncedAt,
  hasPreferencesPendingChanges,
  isSyncFresh,
} from '@/utils/sync-ttl';

export type PreferencesSyncStatus = 'idle' | 'syncing' | 'synced' | 'pending' | 'offline';

type PreferencesSyncContextValue = {
  status: PreferencesSyncStatus;
  queuePreferencesSync: () => void;
  runPreferencesSync: () => Promise<void>;
};

const PreferencesSyncContext = createContext<PreferencesSyncContextValue | null>(null);

const PUSH_DEBOUNCE_MS = 800;

export function PreferencesSyncProvider({ children }: { children: ReactNode }) {
  const {
    isHydrated: isAccountHydrated,
    isServerAccount,
    isRestoringAccount,
    error: accountError,
  } = useAccount();
  const {
    displayName,
    isHydrated: isProfileHydrated,
    applySyncedDisplayName,
  } = useAccountProfile();
  const {
    isHydrated: isBodyHydrated,
    applySyncedBodyParameters,
    ...bodyParameters
  } = useBodyParameters();
  const {
    isHydrated: isStylistHydrated,
    applySyncedStylistPreferences,
    ...stylistPreferences
  } = useStylistPreferences();

  const [status, setStatus] = useState<PreferencesSyncStatus>('idle');

  const isApplyingSyncRef = useRef(false);
  const initialSyncStartedRef = useRef(false);
  const pushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInFlightRef = useRef<Promise<void> | null>(null);

  const isReady =
    isAccountHydrated &&
    isProfileHydrated &&
    isBodyHydrated &&
    isStylistHydrated &&
    isServerAccount;

  const getLocalSnapshot = useCallback((): LocalPreferencesSnapshot => {
    return {
      displayName,
      bodyParameters: {
        locationMode: bodyParameters.locationMode,
        manualLocation: bodyParameters.manualLocation,
        autoLocation: bodyParameters.autoLocation,
        heightCm: bodyParameters.heightCm,
        topSize: bodyParameters.topSize,
        bottomSize: bodyParameters.bottomSize,
        shoeSize: bodyParameters.shoeSize,
        fitPreference: bodyParameters.fitPreference,
        weatherSensitivity: bodyParameters.weatherSensitivity,
      },
      stylistPreferences: {
        considerWeather: stylistPreferences.considerWeather,
        styleExperiment: stylistPreferences.styleExperiment,
        wardrobeMode: stylistPreferences.wardrobeMode,
        avoidRepeatedOutfits: stylistPreferences.avoidRepeatedOutfits,
        dailyStylistEnabled: stylistPreferences.dailyStylistEnabled,
        dailyStylistTime: stylistPreferences.dailyStylistTime,
        timezone: stylistPreferences.timezone,
      },
    };
  }, [displayName, bodyParameters, stylistPreferences]);

  const applyServerPreferences = useCallback(
    async (serverPreferences: ServerPreferences) => {
      isApplyingSyncRef.current = true;

      try {
        if (serverPreferences.displayName) {
          applySyncedDisplayName(serverPreferences.displayName);
        }

        if (serverPreferences.bodyParameters) {
          applySyncedBodyParameters(serverPreferences.bodyParameters);
        }

        if (serverPreferences.stylistPreferences) {
          applySyncedStylistPreferences(serverPreferences.stylistPreferences);
        }
      } finally {
        isApplyingSyncRef.current = false;
      }
    },
    [applySyncedBodyParameters, applySyncedDisplayName, applySyncedStylistPreferences],
  );

  const runPreferencesSync = useCallback(async () => {
    if (!isReady || isApplyingSyncRef.current) {
      return;
    }

    if (syncInFlightRef.current) {
      await syncInFlightRef.current;
      return;
    }

    const syncPromise = (async () => {
      const token = await getAuthToken();

      if (!token) {
        console.log('[PREFERENCES SYNC] offline');
        setStatus(accountError ? 'offline' : 'pending');
        return;
      }

      const metadata = await loadPreferencesSyncMetadata();

      if (
        !isRestoringAccount &&
        isSyncFresh(getPreferencesLastSyncedAt(metadata)) &&
        !hasPreferencesPendingChanges(metadata)
      ) {
        console.log('[PREFERENCES SYNC] cache hit');
        setStatus('synced');
        return;
      }

      setStatus('syncing');

      try {
        const serverPreferences = await fetchServerPreferences(token);

        const action = resolvePreferencesSyncAction({ metadata, serverPreferences });

        const syncedAt = new Date().toISOString();

        if (action === 'noop') {
          console.log('[PREFERENCES SYNC] no changes');
          await savePreferencesSyncMetadata({
            localUpdatedAt: metadata.localUpdatedAt ?? serverPreferences.updatedAt,
            serverUpdatedAt: serverPreferences.updatedAt,
            lastServerSyncAt: syncedAt,
          });
          setStatus('synced');
          return;
        }

        if (action === 'pull') {
          console.log('[PREFERENCES SYNC] pull');
          await applyServerPreferences(serverPreferences);

          await savePreferencesSyncMetadata({
            localUpdatedAt: serverPreferences.updatedAt ?? syncedAt,
            serverUpdatedAt: serverPreferences.updatedAt,
            lastServerSyncAt: syncedAt,
          });

          setStatus('synced');
          return;
        }

        console.log('[PREFERENCES SYNC] push');
        const pushed = await pushLocalPreferences({
          token,
          snapshot: getLocalSnapshot(),
          clientUpdatedAt: metadata.localUpdatedAt,
        });

        await savePreferencesSyncMetadata({
          localUpdatedAt: pushed.updatedAt ?? syncedAt,
          serverUpdatedAt: pushed.updatedAt,
          lastServerSyncAt: syncedAt,
        });

        setStatus('synced');
      } catch (error) {
        console.log('[PREFERENCES SYNC] offline');

        if (error instanceof AccountApiError && error.status === 401) {
          setStatus('offline');
          return;
        }

        setStatus('pending');
      }
    })();

    syncInFlightRef.current = syncPromise;

    try {
      await syncPromise;
    } finally {
      syncInFlightRef.current = null;
    }
  }, [accountError, applyServerPreferences, getLocalSnapshot, isReady, isRestoringAccount]);

  const queuePreferencesSync = useCallback(() => {
    if (!isReady || isApplyingSyncRef.current) {
      return;
    }

    setStatus('pending');

    if (pushTimeoutRef.current) {
      clearTimeout(pushTimeoutRef.current);
    }

    pushTimeoutRef.current = setTimeout(() => {
      void runPreferencesSync();
    }, PUSH_DEBOUNCE_MS);
  }, [isReady, runPreferencesSync]);

  useEffect(() => {
    if (!isReady || initialSyncStartedRef.current) {
      return;
    }

    initialSyncStartedRef.current = true;
    void runPreferencesSync();
  }, [isReady, runPreferencesSync]);

  useEffect(() => {
    if (!isReady || !isRestoringAccount) {
      return;
    }

    void runPreferencesSync();
  }, [isReady, isRestoringAccount, runPreferencesSync]);

  const previousAccountErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (previousAccountErrorRef.current && !accountError) {
      void runPreferencesSync();
    }

    previousAccountErrorRef.current = accountError;
  }, [accountError, isReady, runPreferencesSync]);

  useEffect(
    () => () => {
      if (pushTimeoutRef.current) {
        clearTimeout(pushTimeoutRef.current);
      }
    },
    [],
  );

  const value = useMemo(
    () => ({
      status,
      queuePreferencesSync,
      runPreferencesSync,
    }),
    [status, queuePreferencesSync, runPreferencesSync],
  );

  return (
    <PreferencesSyncContext.Provider value={value}>{children}</PreferencesSyncContext.Provider>
  );
}

export function usePreferencesSync() {
  const context = useContext(PreferencesSyncContext);

  if (!context) {
    throw new Error('usePreferencesSync must be used within PreferencesSyncProvider');
  }

  return context;
}
