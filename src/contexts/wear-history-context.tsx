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
import { getLocalCalendarDateKey } from '@/utils/wear-date';

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

  const markOutfitWorn = useCallback(
    (outfit: SavedOutfit): MarkOutfitWornResult => {
      const todayKey = getLocalCalendarDateKey(new Date());
      let result: MarkOutfitWornResult = 'already_today';

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

        const nextEvents = sortWearEventsDesc([nextEvent, ...current]);
        persistWearHistory(nextEvents);
        result = 'created';
        return nextEvents;
      });

      return result;
    },
    [persistWearHistory],
  );

  const removeWearEvent = useCallback(
    (id: string) => {
      setWearEvents((current) => {
        const nextEvents = current.filter((event) => event.id !== id);

        if (nextEvents.length === current.length) {
          return current;
        }

        persistWearHistory(nextEvents);
        return nextEvents;
      });
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
