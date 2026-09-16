import type { WardrobeItem } from '@/contexts/wardrobe-context';
import type { ImageProcessingStatus } from '@/constants/wardrobe-item';
import { AccountApiError } from '@/services/account';
import {
  downloadWardrobeOriginalImage,
  downloadWardrobeProcessedImage,
  uploadWardrobeOriginalImage,
  uploadWardrobeProcessedImage,
} from '@/services/wardrobe-image-api';
import type { WardrobeSnapshot } from '@/services/wardrobe-api';
import {
  loadWardrobeImageSyncMetadata,
  saveWardrobeImageSyncMetadata,
  type WardrobeImageKind,
  type WardrobeImageSyncMetadata,
} from '@/storage/wardrobe-image-sync-storage';
import type { WardrobeSyncMetadata } from '@/storage/wardrobe-sync-storage';
import {
  buildLocalImageFingerprint,
  buildWardrobeLocalOriginalFile,
  buildWardrobeLocalProcessedFile,
  localImageFileExists,
} from '@/utils/wardrobe-local-image-path';

export type WardrobeImageSyncResult = {
  isPending: boolean;
  isOffline: boolean;
};

type WardrobeImageSyncHandlers = {
  applySyncedWardrobeItem: (item: WardrobeItem) => void;
  applySyncedImageUris: (
    itemId: string,
    imageUris: { originalImageUri?: string; processedImageUri?: string },
  ) => void;
};

function isDeletedItem(itemId: string, wardrobeMetadata: WardrobeSyncMetadata): boolean {
  return Boolean(wardrobeMetadata.deletedItems[itemId]);
}

function shouldUploadImage({
  localUri,
  serverAvailable,
  serverUpdatedAt,
  syncEntry,
}: {
  localUri: string | undefined;
  serverAvailable: boolean;
  serverUpdatedAt: string | null;
  syncEntry?: { localFingerprint?: string; serverUpdatedAt?: string };
}): boolean {
  if (!localUri || !localImageFileExists(localUri)) {
    return false;
  }

  const fingerprint = buildLocalImageFingerprint(localUri);

  if (!fingerprint) {
    return false;
  }

  if (!serverAvailable) {
    return true;
  }

  if (!syncEntry?.localFingerprint || syncEntry.localFingerprint !== fingerprint) {
    return true;
  }

  if (
    serverUpdatedAt &&
    syncEntry.serverUpdatedAt &&
    syncEntry.serverUpdatedAt !== serverUpdatedAt
  ) {
    return syncEntry.localFingerprint !== fingerprint;
  }

  return false;
}

function shouldDownloadImage({
  localUri,
  serverAvailable,
  syncEntry,
  serverUpdatedAt,
}: {
  localUri: string | undefined;
  serverAvailable: boolean;
  syncEntry?: { localFingerprint?: string; serverUpdatedAt?: string };
  serverUpdatedAt: string | null;
}): boolean {
  if (!serverAvailable) {
    return false;
  }

  if (!localUri || !localImageFileExists(localUri)) {
    return true;
  }

  if (
    serverUpdatedAt &&
    syncEntry?.serverUpdatedAt &&
    syncEntry.serverUpdatedAt !== serverUpdatedAt
  ) {
    return true;
  }

  return false;
}

async function saveDownloadedImage({
  userId,
  itemId,
  kind,
  bytes,
  contentType,
}: {
  userId: string | null;
  itemId: string;
  kind: WardrobeImageKind;
  bytes: Uint8Array;
  contentType: string;
}): Promise<{ uri: string; fingerprint: string }> {
  const targetFile =
    kind === 'original'
      ? await buildWardrobeLocalOriginalFile(userId, itemId, contentType)
      : await buildWardrobeLocalProcessedFile(userId, itemId);

  if (targetFile.exists) {
    targetFile.delete();
  }

  targetFile.create();
  targetFile.write(bytes);

  if (!targetFile.exists || targetFile.size === 0) {
    throw new Error('Failed to persist downloaded wardrobe image.');
  }

  const fingerprint = buildLocalImageFingerprint(targetFile.uri);

  if (!fingerprint) {
    throw new Error('Failed to fingerprint downloaded wardrobe image.');
  }

  return {
    uri: targetFile.uri,
    fingerprint,
  };
}

function toRestoredWardrobeItem(
  serverItem: WardrobeSnapshot['items'][number],
  imageUris: { originalImageUri?: string; processedImageUri?: string },
): WardrobeItem {
  const originalImageUri = imageUris.originalImageUri ?? imageUris.processedImageUri ?? '';

  return {
    id: serverItem.id,
    name: serverItem.name,
    baseName: serverItem.baseName,
    category: serverItem.category,
    color: serverItem.color,
    pattern: serverItem.pattern,
    printDescription: serverItem.printDescription,
    style: serverItem.style,
    isFavorite: serverItem.isFavorite,
    imageProcessingStatus: (serverItem.imageProcessingStatus ?? 'idle') as ImageProcessingStatus,
    originalImageUri,
    processedImageUri: imageUris.processedImageUri,
  };
}

export async function reconcileWardrobeImages({
  token,
  userId,
  localItems,
  serverSnapshot,
  wardrobeMetadata,
  handlers,
}: {
  token: string;
  userId: string | null;
  localItems: WardrobeItem[];
  serverSnapshot: WardrobeSnapshot;
  wardrobeMetadata: WardrobeSyncMetadata;
  handlers: WardrobeImageSyncHandlers;
}): Promise<WardrobeImageSyncResult> {
  let imageMetadata = await loadWardrobeImageSyncMetadata();
  let isPending = false;
  let isOffline = false;
  const uploadedThisRun = new Set<string>();

  const localItemsById = new Map(localItems.map((item) => [item.id, item]));
  const serverDeletedIds = new Set(serverSnapshot.deletedItems.map((item) => item.id));

  const persistImageMetadata = async (nextMetadata: WardrobeImageSyncMetadata) => {
    imageMetadata = nextMetadata;
    await saveWardrobeImageSyncMetadata(nextMetadata);
  };

  const updateSyncEntry = async ({
    itemId,
    kind,
    localFingerprint,
    serverUpdatedAt,
  }: {
    itemId: string;
    kind: WardrobeImageKind;
    localFingerprint: string;
    serverUpdatedAt: string;
  }) => {
    const currentItem = imageMetadata.items[itemId] ?? {};

    await persistImageMetadata({
      items: {
        ...imageMetadata.items,
        [itemId]: {
          ...currentItem,
          [kind]: {
            localFingerprint,
            serverUpdatedAt,
          },
        },
      },
    });
  };

  for (const item of localItems) {
    if (isDeletedItem(item.id, wardrobeMetadata) || serverDeletedIds.has(item.id)) {
      continue;
    }

    const serverItem = serverSnapshot.items.find((entry) => entry.id === item.id);
    const syncEntry = imageMetadata.items[item.id];

    if (
      shouldUploadImage({
        localUri: item.originalImageUri,
        serverAvailable: serverItem?.images.originalAvailable ?? false,
        serverUpdatedAt: serverItem?.images.originalUpdatedAt ?? null,
        syncEntry: syncEntry?.original,
      })
    ) {
      try {
        const response = await uploadWardrobeOriginalImage(token, item.id, item.originalImageUri);
        const fingerprint = buildLocalImageFingerprint(item.originalImageUri);

        if (fingerprint) {
          await updateSyncEntry({
            itemId: item.id,
            kind: 'original',
            localFingerprint: fingerprint,
            serverUpdatedAt: response.uploadedAt,
          });
        }

        uploadedThisRun.add(`${item.id}:original`);
        console.log('[IMAGE SYNC] upload original');
      } catch (error) {
        if (error instanceof AccountApiError && error.status === 0) {
          console.log('[IMAGE SYNC] offline');
          isOffline = true;
        } else {
          isPending = true;
        }
      }
    }

    if (
      item.processedImageUri &&
      shouldUploadImage({
        localUri: item.processedImageUri,
        serverAvailable: serverItem?.images.processedAvailable ?? false,
        serverUpdatedAt: serverItem?.images.processedUpdatedAt ?? null,
        syncEntry: syncEntry?.processed,
      })
    ) {
      try {
        const response = await uploadWardrobeProcessedImage(
          token,
          item.id,
          item.processedImageUri,
        );
        const fingerprint = buildLocalImageFingerprint(item.processedImageUri);

        if (fingerprint) {
          await updateSyncEntry({
            itemId: item.id,
            kind: 'processed',
            localFingerprint: fingerprint,
            serverUpdatedAt: response.uploadedAt,
          });
        }

        uploadedThisRun.add(`${item.id}:processed`);
        console.log('[IMAGE SYNC] upload processed');
      } catch (error) {
        if (error instanceof AccountApiError && error.status === 0) {
          console.log('[IMAGE SYNC] offline');
          isOffline = true;
        } else {
          isPending = true;
        }
      }
    }
  }

  for (const serverItem of serverSnapshot.items) {
    if (serverDeletedIds.has(serverItem.id) || isDeletedItem(serverItem.id, wardrobeMetadata)) {
      continue;
    }

    const localItem = localItemsById.get(serverItem.id);
    const syncEntry = imageMetadata.items[serverItem.id];
    const imageUris: { originalImageUri?: string; processedImageUri?: string } = {};

    const needsProcessedDownload =
      serverItem.images.processedAvailable &&
      shouldDownloadImage({
        localUri: localItem?.processedImageUri,
        serverAvailable: serverItem.images.processedAvailable,
        syncEntry: syncEntry?.processed,
        serverUpdatedAt: serverItem.images.processedUpdatedAt,
      });

    const needsOriginalDownload =
      serverItem.images.originalAvailable &&
      shouldDownloadImage({
        localUri: localItem?.originalImageUri,
        serverAvailable: serverItem.images.originalAvailable,
        syncEntry: syncEntry?.original,
        serverUpdatedAt: serverItem.images.originalUpdatedAt,
      });

    if (needsProcessedDownload) {
      try {
        const downloaded = await downloadWardrobeProcessedImage(token, serverItem.id);
        const saved = await saveDownloadedImage({
          userId,
          itemId: serverItem.id,
          kind: 'processed',
          bytes: downloaded.bytes,
          contentType: downloaded.contentType,
        });

        imageUris.processedImageUri = saved.uri;

        if (serverItem.images.processedUpdatedAt) {
          await updateSyncEntry({
            itemId: serverItem.id,
            kind: 'processed',
            localFingerprint: saved.fingerprint,
            serverUpdatedAt: serverItem.images.processedUpdatedAt,
          });
        }

        console.log('[IMAGE SYNC] download processed');
      } catch (error) {
        if (error instanceof AccountApiError && error.status === 0) {
          console.log('[IMAGE SYNC] offline');
          isOffline = true;
        } else {
          isPending = true;
        }
      }
    }

    if (needsOriginalDownload) {
      try {
        const downloaded = await downloadWardrobeOriginalImage(token, serverItem.id);
        const saved = await saveDownloadedImage({
          userId,
          itemId: serverItem.id,
          kind: 'original',
          bytes: downloaded.bytes,
          contentType: downloaded.contentType,
        });

        imageUris.originalImageUri = saved.uri;

        if (serverItem.images.originalUpdatedAt) {
          await updateSyncEntry({
            itemId: serverItem.id,
            kind: 'original',
            localFingerprint: saved.fingerprint,
            serverUpdatedAt: serverItem.images.originalUpdatedAt,
          });
        }

        console.log('[IMAGE SYNC] download original');
      } catch (error) {
        if (error instanceof AccountApiError && error.status === 0) {
          console.log('[IMAGE SYNC] offline');
          isOffline = true;
        } else {
          isPending = true;
        }
      }
    }

    const hasDownloadedImage = Boolean(imageUris.originalImageUri || imageUris.processedImageUri);

    if (!localItem && hasDownloadedImage) {
      handlers.applySyncedWardrobeItem(toRestoredWardrobeItem(serverItem, imageUris));
      console.log('[IMAGE SYNC] restore item');
      continue;
    }

    if (localItem && hasDownloadedImage) {
      handlers.applySyncedImageUris(serverItem.id, imageUris);
    }
  }

  if (!isOffline) {
    for (const item of localItems) {
      if (isDeletedItem(item.id, wardrobeMetadata) || serverDeletedIds.has(item.id)) {
        continue;
      }

      const serverItem = serverSnapshot.items.find((entry) => entry.id === item.id);
      const syncEntry = imageMetadata.items[item.id];
      const serverHasOriginal =
        (serverItem?.images.originalAvailable ?? false) ||
        uploadedThisRun.has(`${item.id}:original`);
      const serverHasProcessed =
        (serverItem?.images.processedAvailable ?? false) ||
        uploadedThisRun.has(`${item.id}:processed`);

      if (
        item.originalImageUri &&
        localImageFileExists(item.originalImageUri) &&
        shouldUploadImage({
          localUri: item.originalImageUri,
          serverAvailable: serverHasOriginal,
          serverUpdatedAt: serverItem?.images.originalUpdatedAt ?? null,
          syncEntry: syncEntry?.original,
        })
      ) {
        isPending = true;
      }

      if (
        item.processedImageUri &&
        localImageFileExists(item.processedImageUri) &&
        shouldUploadImage({
          localUri: item.processedImageUri,
          serverAvailable: serverHasProcessed,
          serverUpdatedAt: serverItem?.images.processedUpdatedAt ?? null,
          syncEntry: syncEntry?.processed,
        })
      ) {
        isPending = true;
      }
    }
  }

  return {
    isPending,
    isOffline,
  };
}
