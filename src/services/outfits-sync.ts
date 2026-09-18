import type { SavedOutfit, SavedOutfitSource } from '@/constants/saved-outfit';
import type {
  OutfitsSnapshot,
  OutfitsSyncDeletePayload,
  OutfitsSyncItemPayload,
} from '@/services/outfits-api';
import type { OutfitsSyncMetadata } from '@/storage/outfits-sync-storage';

export type OutfitSyncPatch = {
  title: string;
  description: string;
  source: SavedOutfitSource | null;
  itemIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type OutfitsSyncPlan = {
  outfitsToPush: OutfitsSyncItemPayload[];
  deletedOutfitsToPush: OutfitsSyncDeletePayload[];
  outfitsToApply: Array<{ id: string; outfit: OutfitSyncPatch }>;
  localOutfitsToRemove: string[];
  pullCount: number;
};

function getOutfitUpdatedAt(outfit: SavedOutfit, metadata: OutfitsSyncMetadata): string {
  return metadata.outfitUpdatedAtById[outfit.id] ?? outfit.updatedAt ?? outfit.createdAt;
}

function toSyncPayload(outfit: SavedOutfit, clientUpdatedAt: string): OutfitsSyncItemPayload {
  return {
    id: outfit.id,
    title: outfit.title,
    description: outfit.description,
    source: outfit.source ?? null,
    itemIds: outfit.itemIds,
    createdAt: outfit.createdAt,
    clientUpdatedAt,
  };
}

function toOutfitPatch(outfit: OutfitsSnapshot['outfits'][number]): OutfitSyncPatch {
  return {
    title: outfit.title,
    description: outfit.description,
    source: outfit.source,
    itemIds: outfit.itemIds,
    createdAt: outfit.createdAt,
    updatedAt: outfit.updatedAt,
  };
}

function toSavedOutfit(id: string, patch: OutfitSyncPatch): SavedOutfit {
  return {
    id,
    title: patch.title,
    description: patch.description,
    itemIds: patch.itemIds,
    createdAt: patch.createdAt,
    updatedAt: patch.updatedAt,
    source: patch.source ?? undefined,
  };
}

function compareTimestamps(left: string | null | undefined, right: string | null | undefined): number {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;

  return leftTime - rightTime;
}

export function buildOutfitsSyncPlan({
  localOutfits,
  metadata,
  serverSnapshot,
}: {
  localOutfits: SavedOutfit[];
  metadata: OutfitsSyncMetadata;
  serverSnapshot: OutfitsSnapshot;
}): OutfitsSyncPlan {
  const localOutfitsById = new Map(localOutfits.map((outfit) => [outfit.id, outfit]));
  const serverOutfitsById = new Map(serverSnapshot.outfits.map((outfit) => [outfit.id, outfit]));
  const serverDeletedById = new Map(
    serverSnapshot.deletedOutfits.map((outfit) => [outfit.id, outfit]),
  );

  const outfitsToPush: OutfitsSyncItemPayload[] = [];
  const outfitsToApply: OutfitsSyncPlan['outfitsToApply'] = [];
  const localOutfitsToRemove: string[] = [];
  let pullCount = 0;

  const serverIsEmpty =
    serverSnapshot.outfits.length === 0 && serverSnapshot.deletedOutfits.length === 0;

  if (serverIsEmpty) {
    for (const outfit of localOutfits) {
      outfitsToPush.push(toSyncPayload(outfit, getOutfitUpdatedAt(outfit, metadata)));
    }
  } else {
    for (const outfit of localOutfits) {
      const serverOutfit = serverOutfitsById.get(outfit.id);
      const localUpdatedAt = metadata.outfitUpdatedAtById[outfit.id] ?? null;

      if (!serverOutfit) {
        outfitsToPush.push(toSyncPayload(outfit, getOutfitUpdatedAt(outfit, metadata)));
        continue;
      }

      const comparison = compareTimestamps(localUpdatedAt, serverOutfit.updatedAt);

      if (comparison > 0) {
        outfitsToPush.push(toSyncPayload(outfit, localUpdatedAt!));
      } else if (comparison < 0) {
        outfitsToApply.push({
          id: outfit.id,
          outfit: toOutfitPatch(serverOutfit),
        });
        pullCount += 1;
      }
    }

    for (const serverOutfit of serverSnapshot.outfits) {
      if (!localOutfitsById.has(serverOutfit.id)) {
        outfitsToApply.push({
          id: serverOutfit.id,
          outfit: toOutfitPatch(serverOutfit),
        });
        pullCount += 1;
      }
    }

    for (const [outfitId, serverDeleted] of serverDeletedById.entries()) {
      const localOutfit = localOutfitsById.get(outfitId);
      const localDeleted = metadata.deletedOutfits[outfitId];

      if (!localOutfit) {
        continue;
      }

      const localUpdatedAt = metadata.outfitUpdatedAtById[outfitId] ?? null;
      const localDeleteTime = localDeleted?.deletedAt ?? null;
      const serverDeleteComparison = compareTimestamps(localDeleteTime, serverDeleted.deletedAt);
      const localOutfitComparison = compareTimestamps(localUpdatedAt, serverDeleted.deletedAt);

      if (serverDeleteComparison >= 0 && localOutfitComparison < 0) {
        localOutfitsToRemove.push(outfitId);
      }
    }
  }

  const deletedOutfitsToPush = Object.entries(metadata.deletedOutfits).map(([id, tombstone]) => ({
    id,
    clientDeletedAt: tombstone.deletedAt,
  }));

  return {
    outfitsToPush,
    deletedOutfitsToPush,
    outfitsToApply,
    localOutfitsToRemove,
    pullCount,
  };
}

export function buildOutfitsMetadataAfterSync({
  metadata,
  serverSnapshot,
  acknowledgedDeleteIds,
}: {
  metadata: OutfitsSyncMetadata;
  serverSnapshot: OutfitsSnapshot;
  acknowledgedDeleteIds: string[];
}): OutfitsSyncMetadata {
  const nextDeletedOutfits = { ...metadata.deletedOutfits };
  const nextOutfitUpdatedAtById = { ...metadata.outfitUpdatedAtById };
  const nextServerUpdatedAtById = { ...metadata.serverUpdatedAtById };

  for (const deleteId of acknowledgedDeleteIds) {
    delete nextDeletedOutfits[deleteId];
  }

  for (const outfit of serverSnapshot.outfits) {
    nextServerUpdatedAtById[outfit.id] = outfit.updatedAt;
    nextOutfitUpdatedAtById[outfit.id] = outfit.updatedAt;
  }

  for (const deletedOutfit of serverSnapshot.deletedOutfits) {
    delete nextOutfitUpdatedAtById[deletedOutfit.id];
    delete nextServerUpdatedAtById[deletedOutfit.id];
  }

  return {
    outfitUpdatedAtById: nextOutfitUpdatedAtById,
    serverUpdatedAtById: nextServerUpdatedAtById,
    deletedOutfits: nextDeletedOutfits,
    lastServerSyncAt: serverSnapshot.serverTime,
  };
}

export { toSavedOutfit };
