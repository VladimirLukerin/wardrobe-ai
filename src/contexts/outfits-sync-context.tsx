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
import { useOutfits } from '@/contexts/outfits-context';
import { useWardrobeSync } from '@/contexts/wardrobe-sync-context';
import { AccountApiError } from '@/services/account';
import { fetchOutfitsSnapshot, postOutfitsSync } from '@/services/outfits-api';
import {
  buildOutfitsMetadataAfterSync,
  buildOutfitsSyncPlan,
  toSavedOutfit,
} from '@/services/outfits-sync';
import { getAuthToken } from '@/storage/auth-token-storage';
import {
  loadOutfitsSyncMetadata,
  saveOutfitsSyncMetadata,
} from '@/storage/outfits-sync-storage';
import {
  queueOutfitsSyncFromMutation,
  registerOutfitsSyncQueue,
  unregisterOutfitsSyncQueue,
} from '@/utils/outfits-sync-queue';
import { hasOutfitsPendingChanges, isSyncFresh } from '@/utils/sync-ttl';

export type OutfitsSyncStatus = 'idle' | 'syncing' | 'synced' | 'pending' | 'offline' | 'error';

type OutfitsSyncContextValue = {
  status: OutfitsSyncStatus;
  queueOutfitsSync: () => void;
  runOutfitsSync: () => Promise<void>;
};

const OutfitsSyncContext = createContext<OutfitsSyncContextValue | null>(null);

const PUSH_DEBOUNCE_MS = 1000;

function isWardrobeInitialSyncComplete(status: ReturnType<typeof useWardrobeSync>['status']): boolean {
  return status === 'synced' || status === 'pending' || status === 'offline' || status === 'error';
}

export function OutfitsSyncProvider({ children }: { children: ReactNode }) {
  const {
    isHydrated: isAccountHydrated,
    isServerAccount,
    isRestoringAccount,
    error: accountError,
  } = useAccount();
  const { status: wardrobeSyncStatus } = useWardrobeSync();
  const {
    savedOutfits,
    isHydrated: isOutfitsHydrated,
    applySyncedOutfit,
    applySyncedOutfitRemoval,
  } = useOutfits();

  const [status, setStatus] = useState<OutfitsSyncStatus>('idle');

  const isApplyingSyncRef = useRef(false);
  const initialSyncStartedRef = useRef(false);
  const pushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const previousAccountErrorRef = useRef<string | null>(null);

  const isReady =
    isAccountHydrated &&
    isOutfitsHydrated &&
    isServerAccount &&
    isWardrobeInitialSyncComplete(wardrobeSyncStatus);

  const applyServerOutfits = useCallback(
    (entries: Array<{ id: string; outfit: Parameters<typeof toSavedOutfit>[1] }>) => {
      isApplyingSyncRef.current = true;

      try {
        for (const entry of entries) {
          applySyncedOutfit(toSavedOutfit(entry.id, entry.outfit));
        }
      } finally {
        isApplyingSyncRef.current = false;
      }
    },
    [applySyncedOutfit],
  );

  const runOutfitsSync = useCallback(async () => {
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
        console.log('[OUTFITS SYNC] offline');
        setStatus(accountError ? 'offline' : 'pending');
        return;
      }

      const metadata = await loadOutfitsSyncMetadata();

      if (
        !isRestoringAccount &&
        isSyncFresh(metadata.lastServerSyncAt) &&
        !hasOutfitsPendingChanges(metadata)
      ) {
        console.log('[OUTFITS SYNC] cache hit');
        setStatus('synced');
        return;
      }

      setStatus('syncing');

      try {
        const serverSnapshot = await fetchOutfitsSnapshot(token);

        const plan = buildOutfitsSyncPlan({
          localOutfits: savedOutfits,
          metadata,
          serverSnapshot,
        });

        if (plan.outfitsToApply.length > 0) {
          console.log(`[OUTFITS SYNC] pull ${plan.pullCount}`);
          applyServerOutfits(plan.outfitsToApply);
        }

        for (const outfitId of plan.localOutfitsToRemove) {
          applySyncedOutfitRemoval(outfitId);
        }

        const shouldPush =
          plan.outfitsToPush.length > 0 ||
          plan.deletedOutfitsToPush.length > 0 ||
          (serverSnapshot.outfits.length === 0 &&
            serverSnapshot.deletedOutfits.length === 0 &&
            savedOutfits.length > 0);

        let resultingSnapshot = serverSnapshot;

        if (shouldPush) {
          console.log(`[OUTFITS SYNC] push ${plan.outfitsToPush.length}`);
          if (plan.deletedOutfitsToPush.length > 0) {
            console.log(`[OUTFITS SYNC] delete ${plan.deletedOutfitsToPush.length}`);
          }

          resultingSnapshot = await postOutfitsSync(token, {
            outfits: plan.outfitsToPush,
            deletedOutfits: plan.deletedOutfitsToPush,
          });
        } else if (
          plan.outfitsToApply.length === 0 &&
          plan.localOutfitsToRemove.length === 0
        ) {
          console.log('[OUTFITS SYNC] no changes');
        }

        const acknowledgedDeleteIds = plan.deletedOutfitsToPush.map((entry) => entry.id);
        const nextMetadata = buildOutfitsMetadataAfterSync({
          metadata,
          serverSnapshot: resultingSnapshot,
          acknowledgedDeleteIds,
        });

        await saveOutfitsSyncMetadata(nextMetadata);
        setStatus('synced');
      } catch (error) {
        console.log('[OUTFITS SYNC] offline');

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
    applyServerOutfits,
    applySyncedOutfitRemoval,
    isReady,
    isRestoringAccount,
    savedOutfits,
  ]);

  const queueOutfitsSync = useCallback(() => {
    if (!isReady || isApplyingSyncRef.current) {
      return;
    }

    setStatus('pending');

    if (pushTimeoutRef.current) {
      clearTimeout(pushTimeoutRef.current);
    }

    pushTimeoutRef.current = setTimeout(() => {
      void runOutfitsSync();
    }, PUSH_DEBOUNCE_MS);
  }, [isReady, runOutfitsSync]);

  useEffect(() => {
    registerOutfitsSyncQueue(queueOutfitsSync);

    return () => {
      unregisterOutfitsSyncQueue();
    };
  }, [queueOutfitsSync]);

  useEffect(() => {
    if (!isReady || initialSyncStartedRef.current) {
      return;
    }

    initialSyncStartedRef.current = true;
    void runOutfitsSync();
  }, [isReady, runOutfitsSync]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (previousAccountErrorRef.current && !accountError) {
      void runOutfitsSync();
    }

    previousAccountErrorRef.current = accountError;
  }, [accountError, isReady, runOutfitsSync]);

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
      queueOutfitsSync,
      runOutfitsSync,
    }),
    [status, queueOutfitsSync, runOutfitsSync],
  );

  return (
    <OutfitsSyncContext.Provider value={value}>{children}</OutfitsSyncContext.Provider>
  );
}

export function useOutfitsSync() {
  const context = useContext(OutfitsSyncContext);

  if (!context) {
    throw new Error('useOutfitsSync must be used within OutfitsSyncProvider');
  }

  return context;
}
