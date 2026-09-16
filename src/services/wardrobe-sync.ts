import type { WardrobeItem } from '@/contexts/wardrobe-context';
import type {
  WardrobeSnapshot,
  WardrobeSyncDeletePayload,
  WardrobeSyncItemPayload,
} from '@/services/wardrobe-api';
import type { WardrobeSyncMetadata } from '@/storage/wardrobe-sync-storage';

export type WardrobeMetadataPatch = {
  name: string;
  baseName: string;
  category: string;
  color: string;
  pattern: string;
  printDescription: string | null;
  style: string;
  isFavorite: boolean;
  imageProcessingStatus: WardrobeItem['imageProcessingStatus'];
};

export type WardrobeSyncPlan = {
  itemsToPush: WardrobeSyncItemPayload[];
  deletedItemsToPush: WardrobeSyncDeletePayload[];
  metadataToApply: Array<{ id: string; metadata: WardrobeMetadataPatch; updatedAt: string }>;
  localItemsToRemove: string[];
  pullCount: number;
};

function toSyncPayload(item: WardrobeItem, clientUpdatedAt: string): WardrobeSyncItemPayload {
  return {
    id: item.id,
    name: item.name,
    baseName: item.baseName,
    category: item.category,
    color: item.color,
    pattern: item.pattern,
    printDescription: item.printDescription,
    style: item.style,
    isFavorite: item.isFavorite === true,
    imageProcessingStatus: item.imageProcessingStatus ?? null,
    clientUpdatedAt,
  };
}

function toMetadataPatch(item: WardrobeSyncItemPayload | WardrobeSnapshot['items'][number]): WardrobeMetadataPatch {
  return {
    name: item.name,
    baseName: item.baseName,
    category: item.category,
    color: item.color,
    pattern: item.pattern,
    printDescription: item.printDescription,
    style: item.style,
    isFavorite: item.isFavorite,
    imageProcessingStatus: (item.imageProcessingStatus ?? 'idle') as WardrobeItem['imageProcessingStatus'],
  };
}

function compareTimestamps(left: string | null | undefined, right: string | null | undefined): number {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;

  return leftTime - rightTime;
}

export function buildWardrobeSyncPlan({
  localItems,
  metadata,
  serverSnapshot,
}: {
  localItems: WardrobeItem[];
  metadata: WardrobeSyncMetadata;
  serverSnapshot: WardrobeSnapshot;
}): WardrobeSyncPlan {
  const localItemsById = new Map(localItems.map((item) => [item.id, item]));
  const serverItemsById = new Map(serverSnapshot.items.map((item) => [item.id, item]));
  const serverDeletedById = new Map(serverSnapshot.deletedItems.map((item) => [item.id, item]));

  const itemsToPush: WardrobeSyncItemPayload[] = [];
  const metadataToApply: WardrobeSyncPlan['metadataToApply'] = [];
  const localItemsToRemove: string[] = [];
  let pullCount = 0;

  const serverIsEmpty =
    serverSnapshot.items.length === 0 && serverSnapshot.deletedItems.length === 0;

  if (serverIsEmpty) {
    for (const item of localItems) {
      const clientUpdatedAt =
        metadata.itemUpdatedAtById[item.id] ?? new Date().toISOString();

      itemsToPush.push(toSyncPayload(item, clientUpdatedAt));
    }
  } else {
    for (const item of localItems) {
      const serverItem = serverItemsById.get(item.id);
      const localUpdatedAt = metadata.itemUpdatedAtById[item.id] ?? null;

      if (!serverItem) {
        itemsToPush.push(
          toSyncPayload(item, localUpdatedAt ?? new Date().toISOString()),
        );
        continue;
      }

      const comparison = compareTimestamps(localUpdatedAt, serverItem.updatedAt);

      if (comparison > 0) {
        itemsToPush.push(toSyncPayload(item, localUpdatedAt!));
      } else if (comparison < 0) {
        metadataToApply.push({
          id: item.id,
          metadata: toMetadataPatch(serverItem),
          updatedAt: serverItem.updatedAt,
        });
        pullCount += 1;
      }
    }

    for (const [itemId, serverDeleted] of serverDeletedById.entries()) {
      const localItem = localItemsById.get(itemId);
      const localDeleted = metadata.deletedItems[itemId];

      if (!localItem) {
        continue;
      }

      const localUpdatedAt = metadata.itemUpdatedAtById[itemId] ?? null;
      const localDeleteTime = localDeleted?.deletedAt ?? null;
      const serverDeleteComparison = compareTimestamps(localDeleteTime, serverDeleted.deletedAt);
      const localItemComparison = compareTimestamps(localUpdatedAt, serverDeleted.deletedAt);

      if (serverDeleteComparison >= 0 && localItemComparison < 0) {
        localItemsToRemove.push(itemId);
      }
    }
  }

  const deletedItemsToPush = Object.entries(metadata.deletedItems).map(([id, tombstone]) => ({
    id,
    clientDeletedAt: tombstone.deletedAt,
  }));

  return {
    itemsToPush,
    deletedItemsToPush,
    metadataToApply,
    localItemsToRemove,
    pullCount,
  };
}

export function buildMetadataAfterSync({
  metadata,
  serverSnapshot,
  acknowledgedDeleteIds,
}: {
  metadata: WardrobeSyncMetadata;
  serverSnapshot: WardrobeSnapshot;
  acknowledgedDeleteIds: string[];
}): WardrobeSyncMetadata {
  const nextDeletedItems = { ...metadata.deletedItems };
  const nextItemUpdatedAtById = { ...metadata.itemUpdatedAtById };
  const nextServerUpdatedAtById = { ...metadata.serverUpdatedAtById };

  for (const deleteId of acknowledgedDeleteIds) {
    delete nextDeletedItems[deleteId];
  }

  for (const item of serverSnapshot.items) {
    nextServerUpdatedAtById[item.id] = item.updatedAt;
    nextItemUpdatedAtById[item.id] = item.updatedAt;
  }

  for (const deletedItem of serverSnapshot.deletedItems) {
    delete nextItemUpdatedAtById[deletedItem.id];
    delete nextServerUpdatedAtById[deletedItem.id];
  }

  return {
    itemUpdatedAtById: nextItemUpdatedAtById,
    serverUpdatedAtById: nextServerUpdatedAtById,
    deletedItems: nextDeletedItems,
    lastServerSyncAt: serverSnapshot.serverTime,
  };
}
