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
import { useWardrobe } from '@/contexts/wardrobe-context';
import { AccountApiError } from '@/services/account';
import { fetchWardrobeSnapshot, postWardrobeSync } from '@/services/wardrobe-api';
import { reconcileWardrobeImages } from '@/services/wardrobe-image-sync';
import {
  buildMetadataAfterSync,
  buildWardrobeSyncPlan,
  type WardrobeMetadataPatch,
} from '@/services/wardrobe-sync';
import { getAuthToken } from '@/storage/auth-token-storage';
import {
  loadWardrobeSyncMetadata,
  saveWardrobeSyncMetadata,
} from '@/storage/wardrobe-sync-storage';
import {
  queueWardrobeSyncFromMutation,
  registerWardrobeSyncQueue,
  unregisterWardrobeSyncQueue,
} from '@/utils/wardrobe-sync-queue';
import { hasWardrobePendingChanges, isSyncFresh } from '@/utils/sync-ttl';

export type WardrobeSyncStatus = 'idle' | 'syncing' | 'synced' | 'pending' | 'offline' | 'error';

type WardrobeSyncContextValue = {
  status: WardrobeSyncStatus;
  queueWardrobeSync: () => void;
  runWardrobeSync: () => Promise<void>;
};

const WardrobeSyncContext = createContext<WardrobeSyncContextValue | null>(null);

const PUSH_DEBOUNCE_MS = 1000;

export function WardrobeSyncProvider({ children }: { children: ReactNode }) {
  const {
    isHydrated: isAccountHydrated,
    isServerAccount,
    isRestoringAccount,
    error: accountError,
    user,
  } = useAccount();
  const {
    items,
    isHydrated: isWardrobeHydrated,
    applySyncedItemMetadata,
    applySyncedItemRemoval,
    applySyncedWardrobeItem,
    applySyncedImageUris,
  } = useWardrobe();

  const [status, setStatus] = useState<WardrobeSyncStatus>('idle');

  const isApplyingSyncRef = useRef(false);
  const initialSyncStartedRef = useRef(false);
  const pushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const previousAccountErrorRef = useRef<string | null>(null);

  const isReady = isAccountHydrated && isWardrobeHydrated && isServerAccount;

  const applyServerMetadata = useCallback(
    async (entries: Array<{ id: string; metadata: WardrobeMetadataPatch }>) => {
      isApplyingSyncRef.current = true;

      try {
        for (const entry of entries) {
          applySyncedItemMetadata(entry.id, entry.metadata);
        }
      } finally {
        isApplyingSyncRef.current = false;
      }
    },
    [applySyncedItemMetadata],
  );

  const runWardrobeSync = useCallback(async () => {
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
        console.log('[WARDROBE SYNC] offline');
        setStatus(accountError ? 'offline' : 'pending');
        return;
      }

      const metadata = await loadWardrobeSyncMetadata();

      if (
        !isRestoringAccount &&
        isSyncFresh(metadata.lastServerSyncAt) &&
        !hasWardrobePendingChanges(metadata)
      ) {
        console.log('[WARDROBE SYNC] cache hit');
        setStatus('synced');
        return;
      }

      setStatus('syncing');

      try {
        const serverSnapshot = await fetchWardrobeSnapshot(token);

        const plan = buildWardrobeSyncPlan({
          localItems: items,
          metadata,
          serverSnapshot,
        });

        if (plan.metadataToApply.length > 0) {
          console.log(`[WARDROBE SYNC] pull ${plan.pullCount}`);
          await applyServerMetadata(plan.metadataToApply);
        }

        for (const itemId of plan.localItemsToRemove) {
          applySyncedItemRemoval(itemId);
        }

        const shouldPush =
          plan.itemsToPush.length > 0 ||
          plan.deletedItemsToPush.length > 0 ||
          (serverSnapshot.items.length === 0 &&
            serverSnapshot.deletedItems.length === 0 &&
            items.length > 0);

        let resultingSnapshot = serverSnapshot;

        if (shouldPush) {
          console.log(`[WARDROBE SYNC] push ${plan.itemsToPush.length}`);
          if (plan.deletedItemsToPush.length > 0) {
            console.log(`[WARDROBE SYNC] delete ${plan.deletedItemsToPush.length}`);
          }

          resultingSnapshot = await postWardrobeSync(token, {
            items: plan.itemsToPush,
            deletedItems: plan.deletedItemsToPush,
          });
        } else if (plan.metadataToApply.length === 0 && plan.localItemsToRemove.length === 0) {
          console.log('[WARDROBE SYNC] no changes');
        }

        const acknowledgedDeleteIds = plan.deletedItemsToPush.map((entry) => entry.id);
        const nextMetadata = buildMetadataAfterSync({
          metadata,
          serverSnapshot: resultingSnapshot,
          acknowledgedDeleteIds,
        });

        await saveWardrobeSyncMetadata(nextMetadata);

        const imageResult = await reconcileWardrobeImages({
          token,
          userId: user?.id ?? null,
          localItems: items,
          serverSnapshot: resultingSnapshot,
          wardrobeMetadata: nextMetadata,
          handlers: {
            applySyncedWardrobeItem,
            applySyncedImageUris,
          },
        });

        if (imageResult.isOffline) {
          setStatus('offline');
        } else if (imageResult.isPending) {
          setStatus('pending');
        } else {
          setStatus('synced');
        }
      } catch (error) {
        console.log('[WARDROBE SYNC] offline');

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
    applyServerMetadata,
    applySyncedItemRemoval,
    applySyncedWardrobeItem,
    applySyncedImageUris,
    isReady,
    isRestoringAccount,
    items,
    user?.id,
  ]);

  const queueWardrobeSync = useCallback(() => {
    if (!isReady || isApplyingSyncRef.current) {
      return;
    }

    setStatus('pending');

    if (pushTimeoutRef.current) {
      clearTimeout(pushTimeoutRef.current);
    }

    pushTimeoutRef.current = setTimeout(() => {
      void runWardrobeSync();
    }, PUSH_DEBOUNCE_MS);
  }, [isReady, runWardrobeSync]);

  useEffect(() => {
    registerWardrobeSyncQueue(queueWardrobeSync);

    return () => {
      unregisterWardrobeSyncQueue();
    };
  }, [queueWardrobeSync]);

  useEffect(() => {
    if (!isReady || initialSyncStartedRef.current) {
      return;
    }

    initialSyncStartedRef.current = true;
    void runWardrobeSync();
  }, [isReady, runWardrobeSync]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (previousAccountErrorRef.current && !accountError) {
      void runWardrobeSync();
    }

    previousAccountErrorRef.current = accountError;
  }, [accountError, isReady, runWardrobeSync]);

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
      queueWardrobeSync,
      runWardrobeSync,
    }),
    [status, queueWardrobeSync, runWardrobeSync],
  );

  return (
    <WardrobeSyncContext.Provider value={value}>{children}</WardrobeSyncContext.Provider>
  );
}

export function useWardrobeSync() {
  const context = useContext(WardrobeSyncContext);

  if (!context) {
    throw new Error('useWardrobeSync must be used within WardrobeSyncProvider');
  }

  return context;
}
