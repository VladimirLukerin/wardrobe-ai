import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { SavedOutfit } from '@/constants/saved-outfit';
import type { WearEvent } from '@/constants/wear-event';
import { loadWearHistory, saveWearHistory } from '@/storage/wear-history-storage';
import { markWearEventDeleted, markWearEventUpdated } from '@/storage/wear-history-sync-storage';
import { getLocalCalendarDateKey } from '@/utils/wear-date';
import { queueWearHistorySyncFromMutation } from '@/utils/wear-history-sync-queue';

export type MarkOutfitWornResult = 'created' | 'already_today';

type WearHistoryContextValue = {
  wearEvents: WearEvent[];
  isHydrated: boolean;
  markOutfitWorn: (outfit: SavedOutfit) => MarkOutfitWornResult;
  removeWearEvent: (id: string) => void;
  getOutfitWearCount: (outfitId: string) => number;
  getLastWornAt: (outfitId: string) => string | null;
  isOutfitWornToday: (outfitId: string) => boolean;
  getItemWearCount: (itemId: string) => number;
  getItemLastWornAt: (itemId: string) => string | null;
  getItemWearEvents: (itemId: string) => WearEvent[];
  applySyncedWearEvent: (event: WearEvent) => void;
  applySyncedWearEventRemoval: (id: string) => void;
};

const WearHistoryContext = createContext<WearHistoryContextValue | null>(null);

function createWearEventId(): string {
  return `wear-${Date.now()}`;
}

function sortWearEventsDesc(events: WearEvent[]): WearEvent[] {
  return [...events].sort(
    (left, right) => new Date(right.wornAt).getTime() - new Date(left.wornAt).getTime(),
  );
}

export function WearHistoryProvider({ children }: { children: ReactNode }) {
  const [wearEvents, setWearEvents] = useState<WearEvent[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  const persistWearHistory = useCallback((nextEvents: WearEvent[]) => {
    void saveWearHistory(nextEvents);
  }, []);

  useEffect(() => {
    let isMounted = true;

    loadWearHistory()
      .then((stored) => {
        if (isMounted) {
          setWearEvents(sortWearEventsDesc(stored));
          setIsHydrated(true);
        }
      })
      .catch(() => {
        if (isMounted) {
          setWearEvents([]);
          setIsHydrated(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const isOutfitWornToday = useCallback(
    (outfitId: string): boolean => {
      const todayKey = getLocalCalendarDateKey(new Date());

      return wearEvents.some(
        (event) =>
          event.outfitId === outfitId &&
          getLocalCalendarDateKey(event.wornAt) === todayKey,
      );
    },
    [wearEvents],
  );

  const applySyncedWearEvent = useCallback(
    (event: WearEvent) => {
      setWearEvents((current) => {
        const existingIndex = current.findIndex((entry) => entry.id === event.id);
        const nextEvents =
          existingIndex === -1
            ? sortWearEventsDesc([event, ...current])
            : sortWearEventsDesc(
                current.map((entry, index) => (index === existingIndex ? event : entry)),
              );

        persistWearHistory(nextEvents);
        return nextEvents;
      });
    },
    [persistWearHistory],
  );

  const applySyncedWearEventRemoval = useCallback(
    (id: string) => {
      setWearEvents((current) => {
        const nextEvents = current.filter((event) => event.id !== id);
        persistWearHistory(nextEvents);
        return nextEvents;
      });
    },
    [persistWearHistory],
  );

  const markOutfitWorn = useCallback(
    (outfit: SavedOutfit): MarkOutfitWornResult => {
      const todayKey = getLocalCalendarDateKey(new Date());
      let result: MarkOutfitWornResult = 'already_today';
      let createdEventId: string | null = null;
      let createdEventWornAt: string | null = null;

      setWearEvents((current) => {
        const alreadyWornToday = current.some(
          (event) =>
            event.outfitId === outfit.id &&
            getLocalCalendarDateKey(event.wornAt) === todayKey,
        );

        if (alreadyWornToday) {
          result = 'already_today';
          return current;
        }

        const nextEvent: WearEvent = {
          id: createWearEventId(),
          outfitId: outfit.id,
          itemIds: [...outfit.itemIds],
          wornAt: new Date().toISOString(),
        };

        createdEventId = nextEvent.id;
        createdEventWornAt = nextEvent.wornAt;
        const nextEvents = sortWearEventsDesc([nextEvent, ...current]);
        persistWearHistory(nextEvents);
        result = 'created';
        return nextEvents;
      });

      if (createdEventId && createdEventWornAt) {
        void markWearEventUpdated(createdEventId, createdEventWornAt);
        queueWearHistorySyncFromMutation();
      }

      return result;
    },
    [persistWearHistory],
  );

  const removeWearEvent = useCallback(
    (id: string) => {
      void markWearEventDeleted(id);

      setWearEvents((current) => {
        const nextEvents = current.filter((event) => event.id !== id);

        if (nextEvents.length === current.length) {
          return current;
        }

        persistWearHistory(nextEvents);
        return nextEvents;
      });

      queueWearHistorySyncFromMutation();
    },
    [persistWearHistory],
  );

  const getOutfitWearCount = useCallback(
    (outfitId: string): number =>
      wearEvents.filter((event) => event.outfitId === outfitId).length,
    [wearEvents],
  );

  const getLastWornAt = useCallback(
    (outfitId: string): string | null => {
      const latest = wearEvents.find((event) => event.outfitId === outfitId);
      return latest?.wornAt ?? null;
    },
    [wearEvents],
  );

  const getItemWearCount = useCallback(
    (itemId: string): number =>
      wearEvents.filter((event) => event.itemIds.includes(itemId)).length,
    [wearEvents],
  );

  const getItemLastWornAt = useCallback(
    (itemId: string): string | null => {
      const latest = wearEvents.find((event) => event.itemIds.includes(itemId));
      return latest?.wornAt ?? null;
    },
    [wearEvents],
  );

  const getItemWearEvents = useCallback(
    (itemId: string): WearEvent[] =>
      wearEvents.filter((event) => event.itemIds.includes(itemId)),
    [wearEvents],
  );

  const value = useMemo(
    () => ({
      wearEvents,
      isHydrated,
      markOutfitWorn,
      removeWearEvent,
      getOutfitWearCount,
      getLastWornAt,
      isOutfitWornToday,
      getItemWearCount,
      getItemLastWornAt,
      getItemWearEvents,
      applySyncedWearEvent,
      applySyncedWearEventRemoval,
    }),
    [
      wearEvents,
      isHydrated,
      markOutfitWorn,
      removeWearEvent,
      getOutfitWearCount,
      getLastWornAt,
      isOutfitWornToday,
      getItemWearCount,
      getItemLastWornAt,
      getItemWearEvents,
      applySyncedWearEvent,
      applySyncedWearEventRemoval,
    ],
  );

  return <WearHistoryContext.Provider value={value}>{children}</WearHistoryContext.Provider>;
}

export function useWearHistory() {
  const context = useContext(WearHistoryContext);

  if (!context) {
    throw new Error('useWearHistory must be used within WearHistoryProvider');
  }

  return context;
}
