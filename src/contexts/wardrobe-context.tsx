import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  normalizeWardrobeItemImageFields,
  type ImageProcessingStatus,
  type WardrobeItemImageFields,
} from '@/constants/wardrobe-item';
import { loadWardrobeItems, saveWardrobeItems } from '@/storage/wardrobe-storage';
import {
  markWardrobeItemDeleted,
  markWardrobeItemUpdated,
} from '@/storage/wardrobe-sync-storage';
import { queueWardrobeSyncFromMutation } from '@/utils/wardrobe-sync-queue';

export type WardrobeItem = WardrobeItemImageFields & {
  id: string;
  name: string;
  baseName: string;
  category: string;
  color: string;
  pattern: string;
  printDescription: string | null;
  style: string;
  isFavorite?: boolean;
};

type AddWardrobeItemInput = Omit<WardrobeItem, 'id'>;

type UpdateWardrobeItemInput = Partial<Omit<WardrobeItem, 'id'>>;

export type WardrobeItemMetadataPatch = {
  name: string;
  baseName: string;
  category: string;
  color: string;
  pattern: string;
  printDescription: string | null;
  style: string;
  isFavorite: boolean;
  imageProcessingStatus: ImageProcessingStatus;
};

type WardrobeContextValue = {
  items: WardrobeItem[];
  isHydrated: boolean;
  addItem: (item: AddWardrobeItemInput) => WardrobeItem;
  updateItem: (id: string, updates: UpdateWardrobeItemInput) => void;
  removeItem: (id: string) => void;
  toggleFavorite: (id: string) => void;
  applySyncedItemMetadata: (id: string, metadata: WardrobeItemMetadataPatch) => void;
  applySyncedItemRemoval: (id: string) => void;
  applySyncedWardrobeItem: (item: WardrobeItem) => void;
  applySyncedImageUris: (
    id: string,
    imageUris: { originalImageUri?: string; processedImageUri?: string },
  ) => void;
};

const WardrobeContext = createContext<WardrobeContextValue | null>(null);

function createWardrobeItemId(originalImageUri: string): string {
  return `${Date.now()}-${originalImageUri}`;
}

function normalizeWardrobeItem(item: WardrobeItem): WardrobeItem {
  const imageFields = normalizeWardrobeItemImageFields(item);

  return {
    ...item,
    ...imageFields,
    isFavorite: item.isFavorite === true,
  };
}

export function WardrobeProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  const persistItems = useCallback((nextItems: WardrobeItem[]) => {
    void saveWardrobeItems(nextItems);
  }, []);

  useEffect(() => {
    let isMounted = true;

    loadWardrobeItems()
      .then((stored) => {
        if (isMounted) {
          setItems(stored.map(normalizeWardrobeItem));
          setIsHydrated(true);
        }
      })
      .catch(() => {
        if (isMounted) {
          setItems([]);
          setIsHydrated(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const applySyncedItemMetadata = useCallback(
    (id: string, metadata: WardrobeItemMetadataPatch) => {
      setItems((current) => {
        const nextItems = current.map((item) => {
          if (item.id !== id) {
            return item;
          }

          return normalizeWardrobeItem({
            ...item,
            ...metadata,
          });
        });

        persistItems(nextItems);
        return nextItems;
      });
    },
    [persistItems],
  );

  const applySyncedItemRemoval = useCallback(
    (id: string) => {
      setItems((current) => {
        const nextItems = current.filter((item) => item.id !== id);
        persistItems(nextItems);
        return nextItems;
      });
    },
    [persistItems],
  );

  const applySyncedWardrobeItem = useCallback(
    (item: WardrobeItem) => {
      setItems((current) => {
        const existingIndex = current.findIndex((entry) => entry.id === item.id);
        const normalizedItem = normalizeWardrobeItem(item);
        const nextItems =
          existingIndex === -1
            ? [...current, normalizedItem]
            : current.map((entry, index) => (index === existingIndex ? normalizedItem : entry));

        persistItems(nextItems);
        return nextItems;
      });
    },
    [persistItems],
  );

  const applySyncedImageUris = useCallback(
    (
      id: string,
      imageUris: { originalImageUri?: string; processedImageUri?: string },
    ) => {
      setItems((current) => {
        const nextItems = current.map((item) => {
          if (item.id !== id) {
            return item;
          }

          return normalizeWardrobeItem({
            ...item,
            ...(imageUris.originalImageUri ? { originalImageUri: imageUris.originalImageUri } : {}),
            ...(imageUris.processedImageUri
              ? { processedImageUri: imageUris.processedImageUri }
              : {}),
          });
        });

        persistItems(nextItems);
        return nextItems;
      });
    },
    [persistItems],
  );

  const addItem = useCallback(
    (item: AddWardrobeItemInput): WardrobeItem => {
      const imageFields = normalizeWardrobeItemImageFields(item);
      const nextItem: WardrobeItem = normalizeWardrobeItem({
        ...item,
        ...imageFields,
        id: createWardrobeItemId(imageFields.originalImageUri),
      });

      setItems((current) => {
        const nextItems = [...current, nextItem];
        persistItems(nextItems);
        return nextItems;
      });

      void markWardrobeItemUpdated(nextItem.id);
      queueWardrobeSyncFromMutation();

      return nextItem;
    },
    [persistItems],
  );

  const updateItem = useCallback(
    (id: string, updates: UpdateWardrobeItemInput) => {
      setItems((current) => {
        const nextItems = current.map((item) => {
          if (item.id !== id) {
            return item;
          }

          return normalizeWardrobeItem({
            ...item,
            ...updates,
            ...normalizeWardrobeItemImageFields({ ...item, ...updates }),
          });
        });

        persistItems(nextItems);
        return nextItems;
      });

      void markWardrobeItemUpdated(id);
      queueWardrobeSyncFromMutation();
    },
    [persistItems],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      setItems((current) => {
        const nextItems = current.map((item) => {
          if (item.id !== id) {
            return item;
          }

          return normalizeWardrobeItem({
            ...item,
            isFavorite: !(item.isFavorite === true),
          });
        });

        persistItems(nextItems);
        return nextItems;
      });

      void markWardrobeItemUpdated(id);
      queueWardrobeSyncFromMutation();
    },
    [persistItems],
  );

  const removeItem = useCallback(
    (id: string) => {
      void markWardrobeItemDeleted(id);

      setItems((current) => {
        const nextItems = current.filter((item) => item.id !== id);
        persistItems(nextItems);
        return nextItems;
      });

      queueWardrobeSyncFromMutation();
    },
    [persistItems],
  );

  const value = useMemo(
    () => ({
      items,
      isHydrated,
      addItem,
      updateItem,
      removeItem,
      toggleFavorite,
      applySyncedItemMetadata,
      applySyncedItemRemoval,
      applySyncedWardrobeItem,
      applySyncedImageUris,
    }),
    [
      items,
      isHydrated,
      addItem,
      updateItem,
      removeItem,
      toggleFavorite,
      applySyncedItemMetadata,
      applySyncedItemRemoval,
      applySyncedWardrobeItem,
      applySyncedImageUris,
    ],
  );

  return <WardrobeContext.Provider value={value}>{children}</WardrobeContext.Provider>;
}

export function useWardrobe() {
  const context = useContext(WardrobeContext);

  if (!context) {
    throw new Error('useWardrobe must be used within WardrobeProvider');
  }

  return context;
}

export type { ImageProcessingStatus };
