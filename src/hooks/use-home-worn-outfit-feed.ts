import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAccount } from '@/contexts/account-context';
import { useFamily } from '@/contexts/family-context';
import { useOutfits } from '@/contexts/outfits-context';
import { useWearHistory } from '@/contexts/wear-history-context';
import { useWardrobe } from '@/contexts/wardrobe-context';
import { getAuthToken } from '@/storage/auth-token-storage';
import {
  buildHomeWornOutfitFeedDisplayEntries,
  shouldRefreshHomeWornOutfitFeed,
  type WornOutfitFeedDisplayEntry,
} from '@/services/home-worn-outfit-feed';

export type HomeWornOutfitFeedStatus = 'loading' | 'ready' | 'empty';

type UseHomeWornOutfitFeedResult = {
  entries: WornOutfitFeedDisplayEntry[];
  status: HomeWornOutfitFeedStatus;
  refresh: () => Promise<void>;
};

function isBackgroundState(state: AppStateStatus | null): boolean {
  return state === 'background' || state === 'inactive';
}

export function useHomeWornOutfitFeed(): UseHomeWornOutfitFeedResult {
  const { isServerAccount } = useAccount();
  const { members } = useFamily();
  const { wearEvents, isHydrated: isWearHistoryHydrated } = useWearHistory();
  const { savedOutfits, isHydrated: isOutfitsHydrated } = useOutfits();
  const { items, isHydrated: isWardrobeHydrated } = useWardrobe();

  const [entries, setEntries] = useState<WornOutfitFeedDisplayEntry[]>([]);
  const [status, setStatus] = useState<HomeWornOutfitFeedStatus>('loading');

  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const lastRefreshAtRef = useRef(0);
  const requestIdRef = useRef(0);
  const hasEntriesRef = useRef(false);

  const isHydrated = isWearHistoryHydrated && isOutfitsHydrated && isWardrobeHydrated;

  const refresh = useCallback(
    async (forceRefresh = false) => {
      if (!isHydrated) {
        return;
      }

      if (refreshInFlightRef.current) {
        await refreshInFlightRef.current;
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      const run = async () => {
        setStatus((current) => (current === 'ready' ? 'ready' : 'loading'));

        const token = isServerAccount ? await getAuthToken() : null;
        const nextEntries = await buildHomeWornOutfitFeedDisplayEntries({
          wearEvents,
          savedOutfits,
          wardrobeItems: items,
          familyMembers: isServerAccount ? members : [],
          token,
          forceRefresh,
        });

        if (requestIdRef.current !== requestId) {
          return;
        }

        lastRefreshAtRef.current = Date.now();
        hasEntriesRef.current = nextEntries.length > 0;
        setEntries(nextEntries);
        setStatus(nextEntries.length === 0 ? 'empty' : 'ready');
      };

      refreshInFlightRef.current = run()
        .catch((error) => {
          if (__DEV__) {
            console.warn('[HOME WORN FEED] refresh failed:', error);
          }

          if (requestIdRef.current === requestId) {
            setStatus(hasEntriesRef.current ? 'ready' : 'empty');
          }
        })
        .finally(() => {
          refreshInFlightRef.current = null;
        });

      await refreshInFlightRef.current;
    },
    [isHydrated, isServerAccount, items, members, savedOutfits, wearEvents],
  );

  const refreshIfStale = useCallback(() => {
    if (
      !shouldRefreshHomeWornOutfitFeed(members, lastRefreshAtRef.current) &&
      hasEntriesRef.current
    ) {
      return;
    }

    void refresh(false);
  }, [members, refresh]);

  useEffect(() => {
    void refresh(false);
  }, [refresh, wearEvents, savedOutfits, items, members, isServerAccount, isHydrated]);

  useFocusEffect(
    useCallback(() => {
      refreshIfStale();
    }, [refreshIfStale]),
  );

  useEffect(() => {
    let previousState: AppStateStatus | null = AppState.currentState;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (isBackgroundState(previousState) && nextState === 'active') {
        refreshIfStale();
      }

      previousState = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, [refreshIfStale]);

  return {
    entries,
    status,
    refresh: () => refresh(true),
  };
}
