import { getOutfitDescription } from '@/utils/outfit-description';
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

import type { SaveOutfitInput, SavedOutfit } from '@/constants/saved-outfit';
import { loadSavedOutfits, saveSavedOutfits } from '@/storage/outfits-storage';
import { markOutfitDeleted, markOutfitUpdated } from '@/storage/outfits-sync-storage';
import { useWardrobe } from '@/contexts/wardrobe-context';
import { queueOutfitsSyncFromMutation } from '@/utils/outfits-sync-queue';
import { replaceSavedOutfitItem } from '@/utils/replace-saved-outfit-item';
import { getOutfitItemIdsSignature } from '@/utils/outfit-item-ids-signature';

type OutfitsContextValue = {
  savedOutfits: SavedOutfit[];
  isHydrated: boolean;
  saveOutfit: (input: SaveOutfitInput) => SavedOutfit;
  removeOutfit: (id: string) => void;
  replaceSavedItem: (outfitId: string, targetId: string, replacementId: string) => void;
  isOutfitSaved: (itemIds: string[]) => boolean;
  toggleSavedOutfit: (input: SaveOutfitInput) => void;
  applySyncedOutfit: (outfit: SavedOutfit) => void;
  applySyncedOutfitRemoval: (id: string) => void;
  resetForDevServerRestore: () => Promise<void>;
  replaceAllSavedOutfitsForDevRestore: (outfits: SavedOutfit[]) => Promise<void>;
};

const OutfitsContext = createContext<OutfitsContextValue | null>(null);

function createSavedOutfitId(itemIds: string[]): string {
  return `saved-${Date.now()}-${getOutfitItemIdsSignature(itemIds)}`;
}

function findSavedOutfitByItemIds(
  outfits: SavedOutfit[],
  itemIds: string[],
): SavedOutfit | undefined {
  const signature = getOutfitItemIdsSignature(itemIds);

  return outfits.find((outfit) => getOutfitItemIdsSignature(outfit.itemIds) === signature);
}

export function OutfitsProvider({ children }: { children: ReactNode }) {
  const { items } = useWardrobe();
  const writes = useRef(Promise.resolve());
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  const persistOutfits = useCallback((nextOutfits: SavedOutfit[]) => {
    writes.current = writes.current.catch(() => {}).then(() => saveSavedOutfits(nextOutfits));
  }, []);

  useEffect(() => {
    let isMounted = true;

    loadSavedOutfits()
      .then((stored) => {
        if (isMounted) {
          setSavedOutfits(stored);
          setIsHydrated(true);
        }
      })
      .catch(() => {
        if (isMounted) {
          setSavedOutfits([]);
          setIsHydrated(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (__DEV__ && isHydrated) {
      console.log(`[STATS AUDIT] context outfits=${savedOutfits.length}`);
    }
  }, [isHydrated, savedOutfits]);

  const applySyncedOutfit = useCallback(
    (outfit: SavedOutfit) => {
      setSavedOutfits((current) => {
        const existingIndex = current.findIndex((entry) => entry.id === outfit.id);
        const nextOutfits =
          existingIndex === -1
            ? [outfit, ...current]
            : current.map((entry, index) => (index === existingIndex ? outfit : entry));

        persistOutfits(nextOutfits);
        return nextOutfits;
      });
    },
    [persistOutfits],
  );

  const applySyncedOutfitRemoval = useCallback(
    (id: string) => {
      setSavedOutfits((current) => {
        const nextOutfits = current.filter((outfit) => outfit.id !== id);
        persistOutfits(nextOutfits);
        return nextOutfits;
      });
    },
    [persistOutfits],
  );

  const saveOutfit = useCallback(
    (input: SaveOutfitInput): SavedOutfit => {
      let savedOutfit: SavedOutfit | undefined;

      setSavedOutfits((current) => {
        const existing = findSavedOutfitByItemIds(current, input.itemIds);

        if (existing) {
          savedOutfit = existing;
          return current;
        }

        const now = new Date().toISOString();
        const nextOutfit: SavedOutfit = {
          id: createSavedOutfitId(input.itemIds),
          title: input.title.trim() || 'Образ',
          itemIds: [...new Set(input.itemIds)],
          description: getOutfitDescription(input.description, items.filter((item) => input.itemIds.includes(item.id)), input.source),
          createdAt: now,
          updatedAt: now,
          source: input.source ?? 'ai',
        };

        savedOutfit = nextOutfit;
        const nextOutfits = [nextOutfit, ...current];
        persistOutfits(nextOutfits);
        return nextOutfits;
      });

      if (savedOutfit) {
        void markOutfitUpdated(savedOutfit.id);
        queueOutfitsSyncFromMutation();
      }

      return savedOutfit!;
    },
    [items, persistOutfits],
  );

  const replaceSavedItem = useCallback((outfitId: string, targetId: string, replacementId: string) => {
    setSavedOutfits((current) => {
      const next = replaceSavedOutfitItem(current, outfitId, targetId, replacementId, items);
      if (next !== current) {
        persistOutfits(next);
        void markOutfitUpdated(outfitId);
        queueOutfitsSyncFromMutation();
      }
      return next;
    });
  }, [items, persistOutfits]);

  const removeOutfit = useCallback(
    (id: string) => {
      void markOutfitDeleted(id);

      setSavedOutfits((current) => {
        const nextOutfits = current.filter((outfit) => outfit.id !== id);

        if (nextOutfits.length === current.length) {
          return current;
        }

        persistOutfits(nextOutfits);
        return nextOutfits;
      });

      queueOutfitsSyncFromMutation();
    },
    [persistOutfits],
  );

  const isOutfitSaved = useCallback(
    (itemIds: string[]) => findSavedOutfitByItemIds(savedOutfits, itemIds) !== undefined,
    [savedOutfits],
  );

  const toggleSavedOutfit = useCallback(
    (input: SaveOutfitInput): void => {
      setSavedOutfits((current) => {
        const existing = findSavedOutfitByItemIds(current, input.itemIds);

        if (existing) {
          void markOutfitDeleted(existing.id);
          const nextOutfits = current.filter((outfit) => outfit.id !== existing.id);
          persistOutfits(nextOutfits);
          queueOutfitsSyncFromMutation();
          return nextOutfits;
        }

        const now = new Date().toISOString();
        const nextOutfit: SavedOutfit = {
          id: createSavedOutfitId(input.itemIds),
          title: input.title.trim() || 'Образ',
          itemIds: [...new Set(input.itemIds)],
          description: getOutfitDescription(input.description, items.filter((item) => input.itemIds.includes(item.id)), input.source),
          createdAt: now,
          updatedAt: now,
          source: input.source ?? 'ai',
        };

        const nextOutfits = [nextOutfit, ...current];
        persistOutfits(nextOutfits);
        void markOutfitUpdated(nextOutfit.id);
        queueOutfitsSyncFromMutation();
        return nextOutfits;
      });
    },
    [items, persistOutfits],
  );

  const resetForDevServerRestore = useCallback(async () => {
    setSavedOutfits([]);
    writes.current = writes.current.catch(() => {}).then(() => saveSavedOutfits([]));
    await writes.current;
  }, []);

  const replaceAllSavedOutfitsForDevRestore = useCallback(async (outfits: SavedOutfit[]) => {
    setSavedOutfits(outfits);
    writes.current = writes.current.catch(() => {}).then(() => saveSavedOutfits(outfits));
    await writes.current;
  }, []);

  const value = useMemo(
    () => ({
      savedOutfits,
      isHydrated,
      saveOutfit,
      removeOutfit,
      replaceSavedItem,
      isOutfitSaved,
      toggleSavedOutfit,
      applySyncedOutfit,
      applySyncedOutfitRemoval,
      resetForDevServerRestore,
      replaceAllSavedOutfitsForDevRestore,
    }),
    [
      savedOutfits,
      isHydrated,
      saveOutfit,
      removeOutfit,
      replaceSavedItem,
      isOutfitSaved,
      toggleSavedOutfit,
      applySyncedOutfit,
      applySyncedOutfitRemoval,
      resetForDevServerRestore,
      replaceAllSavedOutfitsForDevRestore,
    ],
  );

  return <OutfitsContext.Provider value={value}>{children}</OutfitsContext.Provider>;
}

export function useOutfits() {
  const context = useContext(OutfitsContext);

  if (!context) {
    throw new Error('useOutfits must be used within OutfitsProvider');
  }

  return context;
}

export type { SavedOutfit, SaveOutfitInput };
