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
import type { WardrobeItem } from '@/contexts/wardrobe-context';
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
import { shouldSkipWardrobeServerSync } from '@/utils/sync-ttl';
import type { SyncRunOptions } from '@/utils/sync-run-options';

export type WardrobeSyncStatus = 'idle' | 'syncing' | 'synced' | 'pending' | 'offline' | 'error';

type WardrobeSyncContextValue = {
  status: WardrobeSyncStatus;
  queueWardrobeSync: () => void;
  runWardrobeSync: (options?: SyncRunOptions) => Promise<void>;
};

const WardrobeSyncContext = createContext<WardrobeSyncContextValue | null>(null);

const PUSH_DEBOUNCE_MS = 1000;

function normalizeRestoredPlaceholder(id: string, metadata: WardrobeMetadataPatch): WardrobeItem {
  return {
    id,
    ...metadata,
    originalImageUri: '',
    processedImageUri: undefined,
  };
}

function upsertWardrobeItem(current: WardrobeItem[], item: WardrobeItem): WardrobeItem[] {
  const existingIndex = current.findIndex((entry) => entry.id === item.id);

  if (existingIndex === -1) {
    return [...current, item];
  }

  return current.map((entry, index) => (index === existingIndex ? item : entry));
}

function applyMetadataPatches(
  current: WardrobeItem[],
  entries: Array<{ id: string; metadata: WardrobeMetadataPatch }>,
): WardrobeItem[] {
  return current.map((item) => {
    const entry = entries.find((candidate) => candidate.id === item.id);

    if (!entry) {
      return item;
    }

    return {
      ...item,
      ...entry.metadata,
    };
  });
}

export function WardrobeSyncProvider({ children }: { children: ReactNode }) {
  const {
    accountSessionKey,
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
    replaceAllItemsForDevRestore,
  } = useWardrobe();

  const [status, setStatus] = useState<WardrobeSyncStatus>('idle');

  const isApplyingSyncRef = useRef(false);
  const initialSyncStartedRef = useRef(false);
  const pushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const previousAccountErrorRef = useRef<string | null>(null);
  const userIdRef = useRef(user?.id ?? null);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

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

  const runWardrobeSync = useCallback(async (options?: SyncRunOptions) => {
    if (!isReady || isApplyingSyncRef.current) {
      return;
    }

    if (syncInFlightRef.current) {
      await syncInFlightRef.current;
      return;
    }

    const syncSessionKey = accountSessionKey;
    const forceReconciliation = options?.force === true;
    const restoreOnly = options?.restoreOnly === true;

    const syncPromise = (async () => {
      const isCurrentSession = () => syncSessionKey === accountSessionKey;

      const token = await getAuthToken();

      if (!token) {
        console.log('[WARDROBE SYNC] offline');
        setStatus(accountError ? 'offline' : 'pending');
        return;
      }

      const metadata = await loadWardrobeSyncMetadata();
      const localItemsForPlan = restoreOnly ? [] : items;
      const skipMetadataSync =
        !forceReconciliation &&
        shouldSkipWardrobeServerSync(metadata, localItemsForPlan.length, isRestoringAccount);

      if (skipMetadataSync) {
        if (__DEV__) {
          console.log('[WARDROBE TTL] hit');
        }

        console.log('[WARDROBE SYNC] cache hit');
      } else if (__DEV__) {
        const ttlSkipReason =
          localItemsForPlan.length === 0
            ? 'empty-local'
            : Object.keys(metadata.serverUpdatedAtById).length > localItemsForPlan.length
              ? 'incomplete-local'
              : isRestoringAccount
                ? 'restoring'
                : 'pending-or-stale';
        console.log(`[WARDROBE TTL] skip reason=${ttlSkipReason}`);
      }

      setStatus('syncing');

      let syncCompleted = false;

      try {
        let resultingSnapshot;
        let nextMetadata = metadata;
        let itemsForImageReconcile = items;

        if (skipMetadataSync) {
          resultingSnapshot = await fetchWardrobeSnapshot(token);

          if (!isCurrentSession()) {
            return;
          }
        } else {
          const serverSnapshot = await fetchWardrobeSnapshot(token);

          if (!isCurrentSession()) {
            return;
          }

          if (__DEV__) {
            console.log(
              `[WARDROBE SYNC] server=${serverSnapshot.items.length} local=${localItemsForPlan.length}`,
            );
          }

          const plan = buildWardrobeSyncPlan({
            localItems: localItemsForPlan,
            metadata,
            serverSnapshot,
          });

          if (!isCurrentSession()) {
            return;
          }

          let workingItems = localItemsForPlan;

          if (restoreOnly) {
            workingItems = plan.serverItemsToRestore.map((entry) =>
              normalizeRestoredPlaceholder(entry.id, entry.metadata),
            );

            isApplyingSyncRef.current = true;

            try {
              await replaceAllItemsForDevRestore(workingItems);
            } finally {
              isApplyingSyncRef.current = false;
            }

            if (__DEV__) {
              console.log(`[WARDROBE RESTORE] ${workingItems.length}`);
            }
          } else {
            for (const entry of plan.serverItemsToRestore) {
              const restoredItem = normalizeRestoredPlaceholder(entry.id, entry.metadata);
              applySyncedWardrobeItem(restoredItem);
              workingItems = upsertWardrobeItem(workingItems, restoredItem);
            }

            if (plan.metadataToApply.length > 0) {
              console.log(`[WARDROBE SYNC] pull ${plan.pullCount}`);
              await applyServerMetadata(plan.metadataToApply);
              workingItems = applyMetadataPatches(workingItems, plan.metadataToApply);
            }

            if (!isCurrentSession()) {
              return;
            }

            for (const itemId of plan.localItemsToRemove) {
              applySyncedItemRemoval(itemId);
              workingItems = workingItems.filter((item) => item.id !== itemId);
            }

            if (__DEV__ && plan.serverItemsToRestore.length > 0) {
              console.log(`[WARDROBE RESTORE] ${plan.serverItemsToRestore.length}`);
            }
          }

          const shouldPush =
            !restoreOnly &&
            (plan.itemsToPush.length > 0 ||
              plan.deletedItemsToPush.length > 0 ||
              (serverSnapshot.items.length === 0 &&
                serverSnapshot.deletedItems.length === 0 &&
                localItemsForPlan.length > 0));

          resultingSnapshot = serverSnapshot;

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
          nextMetadata = buildMetadataAfterSync({
            metadata,
            serverSnapshot: resultingSnapshot,
            acknowledgedDeleteIds,
          });

          if (!isCurrentSession()) {
            return;
          }

          await saveWardrobeSyncMetadata(nextMetadata);

          if (!isCurrentSession()) {
            return;
          }

          itemsForImageReconcile = workingItems;

          if (restoreOnly && plan.pullCount > 0) {
            console.log(`[WARDROBE SYNC] pull ${plan.pullCount}`);
          }
        }

        const imageResult = await reconcileWardrobeImages({
          token,
          userId: userIdRef.current,
          localItems: itemsForImageReconcile,
          serverSnapshot: resultingSnapshot,
          wardrobeMetadata: nextMetadata,
          handlers: {
            applySyncedWardrobeItem: (item) => {
              if (!isCurrentSession()) {
                return;
              }

              applySyncedWardrobeItem(item);
              itemsForImageReconcile = upsertWardrobeItem(itemsForImageReconcile, item);
            },
          },
        });

        if (!isCurrentSession()) {
          return;
        }

        if (imageResult.isOffline) {
          setStatus('offline');
        } else if (imageResult.isPending) {
          setStatus('pending');
        } else {
          setStatus('synced');
        }

        syncCompleted = true;
      } catch (error) {
        console.log('[WARDROBE SYNC] offline');

        if (error instanceof AccountApiError && error.status === 401) {
          setStatus('offline');
          return;
        }

        setStatus('pending');
      } finally {
        if (!syncCompleted && isCurrentSession()) {
          setStatus((current) => (current === 'syncing' ? 'pending' : current));
        }
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
    applyServerMetadata,
    applySyncedItemRemoval,
    applySyncedWardrobeItem,
    isReady,
    isRestoringAccount,
    items,
    replaceAllItemsForDevRestore,
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
    if (!isReady || !isRestoringAccount) {
      return;
    }

    void runWardrobeSync();
  }, [isReady, isRestoringAccount, runWardrobeSync]);

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
