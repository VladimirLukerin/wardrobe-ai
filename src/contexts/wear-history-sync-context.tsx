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
import { useOutfitsSync } from '@/contexts/outfits-sync-context';
import { useWearHistory } from '@/contexts/wear-history-context';
import { AccountApiError } from '@/services/account';
import { fetchWearHistorySnapshot, postWearHistorySync } from '@/services/wear-history-api';
import {
  buildWearHistoryMetadataAfterSync,
  buildWearHistorySyncPlan,
} from '@/services/wear-history-sync';
import { getAuthToken } from '@/storage/auth-token-storage';
import {
  loadWearHistorySyncMetadata,
  saveWearHistorySyncMetadata,
} from '@/storage/wear-history-sync-storage';
import {
  queueWearHistorySyncFromMutation,
  registerWearHistorySyncQueue,
  unregisterWearHistorySyncQueue,
} from '@/utils/wear-history-sync-queue';
import { hasWearHistoryPendingChanges, isSyncFresh } from '@/utils/sync-ttl';

export type WearHistorySyncStatus = 'idle' | 'syncing' | 'synced' | 'pending' | 'offline' | 'error';

type WearHistorySyncContextValue = {
  status: WearHistorySyncStatus;
  queueWearHistorySync: () => void;
  runWearHistorySync: () => Promise<void>;
};

const WearHistorySyncContext = createContext<WearHistorySyncContextValue | null>(null);

const PUSH_DEBOUNCE_MS = 1000;

function isOutfitsInitialSyncComplete(status: ReturnType<typeof useOutfitsSync>['status']): boolean {
  return status === 'synced' || status === 'pending' || status === 'offline' || status === 'error';
}

export function WearHistorySyncProvider({ children }: { children: ReactNode }) {
  const {
    accountSessionKey,
    isHydrated: isAccountHydrated,
    isServerAccount,
    isRestoringAccount,
    error: accountError,
  } = useAccount();
  const { status: outfitsSyncStatus } = useOutfitsSync();
  const {
    wearEvents,
    isHydrated: isWearHistoryHydrated,
    applySyncedWearEvent,
    applySyncedWearEventRemoval,
  } = useWearHistory();

  const [status, setStatus] = useState<WearHistorySyncStatus>('idle');

  const isApplyingSyncRef = useRef(false);
  const initialSyncStartedRef = useRef(false);
  const pushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const previousAccountErrorRef = useRef<string | null>(null);

  const isReady =
    isAccountHydrated &&
    isWearHistoryHydrated &&
    isServerAccount &&
    isOutfitsInitialSyncComplete(outfitsSyncStatus);

  const applyServerEvents = useCallback(
    (events: Parameters<typeof applySyncedWearEvent>[0][]) => {
      isApplyingSyncRef.current = true;

      try {
        for (const event of events) {
          applySyncedWearEvent(event);
        }
      } finally {
        isApplyingSyncRef.current = false;
      }
    },
    [applySyncedWearEvent],
  );

  const runWearHistorySync = useCallback(async () => {
    if (!isReady || isApplyingSyncRef.current) {
      return;
    }

    if (syncInFlightRef.current) {
      await syncInFlightRef.current;
      return;
    }

    const syncSessionKey = accountSessionKey;

    const syncPromise = (async () => {
      const isCurrentSession = () => syncSessionKey === accountSessionKey;

      const token = await getAuthToken();

      if (!token) {
        console.log('[WEAR SYNC] offline');
        setStatus(accountError ? 'offline' : 'pending');
        return;
      }

      const metadata = await loadWearHistorySyncMetadata();

      if (
        !isRestoringAccount &&
        isSyncFresh(metadata.lastServerSyncAt) &&
        !hasWearHistoryPendingChanges(metadata)
      ) {
        console.log('[WEAR SYNC] cache hit');
        setStatus('synced');
        return;
      }

      setStatus('syncing');

      try {
        const serverSnapshot = await fetchWearHistorySnapshot(token);

        const plan = buildWearHistorySyncPlan({
          localEvents: wearEvents,
          metadata,
          serverSnapshot,
        });

        if (plan.eventsToApply.length > 0) {
          console.log(`[WEAR SYNC] pull ${plan.pullCount}`);

          if (!isCurrentSession()) {
            return;
          }

          applyServerEvents(plan.eventsToApply);

          if (__DEV__) {
            console.log(`[WEAR RESTORE] ${plan.eventsToApply.length}`);
          }
        }

        if (!isCurrentSession()) {
          return;
        }

        for (const eventId of plan.localEventsToRemove) {
          applySyncedWearEventRemoval(eventId);
        }

        const shouldPush =
          plan.eventsToPush.length > 0 ||
          plan.deletedEventsToPush.length > 0 ||
          (serverSnapshot.events.length === 0 &&
            serverSnapshot.deletedEvents.length === 0 &&
            wearEvents.length > 0);

        let resultingSnapshot = serverSnapshot;

        if (shouldPush) {
          console.log(`[WEAR SYNC] push ${plan.eventsToPush.length}`);
          if (plan.deletedEventsToPush.length > 0) {
            console.log(`[WEAR SYNC] delete ${plan.deletedEventsToPush.length}`);
          }

          resultingSnapshot = await postWearHistorySync(token, {
            events: plan.eventsToPush,
            deletedEvents: plan.deletedEventsToPush,
          });
        } else if (plan.eventsToApply.length === 0 && plan.localEventsToRemove.length === 0) {
          console.log('[WEAR SYNC] no changes');
        }

        const acknowledgedDeleteIds = plan.deletedEventsToPush.map((entry) => entry.id);
        const nextMetadata = buildWearHistoryMetadataAfterSync({
          metadata,
          serverSnapshot: resultingSnapshot,
          acknowledgedDeleteIds,
        });

        await saveWearHistorySyncMetadata(nextMetadata);

        if (!isCurrentSession()) {
          return;
        }

        setStatus('synced');
      } catch (error) {
        console.log('[WEAR SYNC] offline');

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
  }, [
    accountError,
    accountSessionKey,
    applyServerEvents,
    applySyncedWearEventRemoval,
    isReady,
    isRestoringAccount,
    wearEvents,
  ]);

  const queueWearHistorySync = useCallback(() => {
    if (!isReady || isApplyingSyncRef.current) {
      return;
    }

    setStatus('pending');

    if (pushTimeoutRef.current) {
      clearTimeout(pushTimeoutRef.current);
    }

    pushTimeoutRef.current = setTimeout(() => {
      void runWearHistorySync();
    }, PUSH_DEBOUNCE_MS);
  }, [isReady, runWearHistorySync]);

  useEffect(() => {
    registerWearHistorySyncQueue(queueWearHistorySync);

    return () => {
      unregisterWearHistorySyncQueue();
    };
  }, [queueWearHistorySync]);

  useEffect(() => {
    if (!isReady || initialSyncStartedRef.current) {
      return;
    }

    initialSyncStartedRef.current = true;
    void runWearHistorySync();
  }, [isReady, runWearHistorySync]);

  useEffect(() => {
    if (!isReady || !isRestoringAccount) {
      return;
    }

    void runWearHistorySync();
  }, [isReady, isRestoringAccount, runWearHistorySync]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (previousAccountErrorRef.current && !accountError) {
      void runWearHistorySync();
    }

    previousAccountErrorRef.current = accountError;
  }, [accountError, isReady, runWearHistorySync]);

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
      queueWearHistorySync,
      runWearHistorySync,
    }),
    [status, queueWearHistorySync, runWearHistorySync],
  );

  return (
    <WearHistorySyncContext.Provider value={value}>{children}</WearHistorySyncContext.Provider>
  );
}

export function useWearHistorySync() {
  const context = useContext(WearHistorySyncContext);

  if (!context) {
    throw new Error('useWearHistorySync must be used within WearHistorySyncProvider');
  }

  return context;
}
