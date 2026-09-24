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
import { shortWardrobeItemId } from '@/utils/short-wardrobe-item-id';

export type WardrobeImageSyncResult = {
  isPending: boolean;
  isOffline: boolean;
};

type WardrobeImageSyncHandlers = {
  applySyncedWardrobeItem: (item: WardrobeItem) => void;
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

function itemHasValidLocalImageUri(uri: string | undefined): boolean {
  return Boolean(uri && localImageFileExists(uri));
}

async function resolveImageUrisFromDisk(
  userId: string | null,
  itemId: string,
  currentItem?: WardrobeItem,
): Promise<{ originalImageUri?: string; processedImageUri?: string }> {
  const resolved: { originalImageUri?: string; processedImageUri?: string } = {};

  if (itemHasValidLocalImageUri(currentItem?.processedImageUri)) {
    resolved.processedImageUri = currentItem?.processedImageUri;
  } else {
    const processedFile = await buildWardrobeLocalProcessedFile(userId, itemId);

    if (processedFile.exists && processedFile.size > 0) {
      resolved.processedImageUri = processedFile.uri;
    }
  }

  if (itemHasValidLocalImageUri(currentItem?.originalImageUri)) {
    resolved.originalImageUri = currentItem?.originalImageUri;
  } else {
    for (const contentType of ['image/jpeg', 'image/png', 'image/webp', 'image/heic']) {
      const originalFile = await buildWardrobeLocalOriginalFile(userId, itemId, contentType);

      if (originalFile.exists && originalFile.size > 0) {
        resolved.originalImageUri = originalFile.uri;
        break;
      }
    }
  }

  return resolved;
}

function mergeDownloadedAndDiskImageUris(
  downloaded: { originalImageUri?: string; processedImageUri?: string },
  fromDisk: { originalImageUri?: string; processedImageUri?: string },
): { originalImageUri?: string; processedImageUri?: string } {
  return {
    processedImageUri: downloaded.processedImageUri ?? fromDisk.processedImageUri,
    originalImageUri: downloaded.originalImageUri ?? fromDisk.originalImageUri,
  };
}

function shouldApplyResolvedImageUris(
  localItem: WardrobeItem,
  resolved: { originalImageUri?: string; processedImageUri?: string },
): boolean {
  if (!resolved.processedImageUri && !resolved.originalImageUri) {
    return false;
  }

  const hasDisplayableImage =
    itemHasValidLocalImageUri(localItem.processedImageUri) ||
    itemHasValidLocalImageUri(localItem.originalImageUri);

  if (!hasDisplayableImage) {
    return true;
  }

  if (
    resolved.processedImageUri &&
    resolved.processedImageUri !== localItem.processedImageUri
  ) {
    return true;
  }

  if (resolved.originalImageUri && resolved.originalImageUri !== localItem.originalImageUri) {
    return true;
  }

  return false;
}

function isPersistedLocalImageUri(uri: string | undefined): boolean {
  return Boolean(uri && localImageFileExists(uri));
}

function buildSyncedImagePatch(
  localItem: WardrobeItem | undefined,
  resolved: { originalImageUri?: string; processedImageUri?: string },
): { originalImageUri?: string; processedImageUri?: string } {
  const patch: { originalImageUri?: string; processedImageUri?: string } = {};

  if (resolved.processedImageUri) {
    patch.processedImageUri = resolved.processedImageUri;
  }

  if (resolved.originalImageUri) {
    patch.originalImageUri = resolved.originalImageUri;
  } else if (
    resolved.processedImageUri &&
    !isPersistedLocalImageUri(localItem?.originalImageUri)
  ) {
    patch.originalImageUri = resolved.processedImageUri;
  }

  return patch;
}

function logImageApply(resolved: { originalImageUri?: string; processedImageUri?: string }): void {
  if (!__DEV__) {
    return;
  }

  console.log(
    `[IMAGE APPLY] processed=${Boolean(resolved.processedImageUri)} original=${Boolean(resolved.originalImageUri)}`,
  );
}

function logImageClientSaveError(error: unknown): void {
  if (!__DEV__) {
    return;
  }

  if (error instanceof Error) {
    console.log(`[IMAGE CLIENT] save error=${error.name}: ${error.message}`);
    return;
  }

  console.log('[IMAGE CLIENT] save error=UnknownError: Save failed');
}

function toWritableImageBytes(bytes: Uint8Array): Uint8Array {
  const payload = new Uint8Array(bytes.byteLength);
  payload.set(bytes);

  return payload;
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
  if (__DEV__) {
    console.log('[IMAGE CLIENT] save start');
  }

  try {
    const targetFile =
      kind === 'original'
        ? await buildWardrobeLocalOriginalFile(userId, itemId, contentType)
        : await buildWardrobeLocalProcessedFile(userId, itemId);

    if (targetFile.exists) {
      targetFile.delete();
    }

    targetFile.write(toWritableImageBytes(bytes));

    if (!localImageFileExists(targetFile.uri)) {
      throw new Error('Downloaded wardrobe image was not written to disk.');
    }

    const fingerprint = buildLocalImageFingerprint(targetFile.uri);

    if (!fingerprint) {
      throw new Error('Failed to fingerprint saved wardrobe image.');
    }

    if (__DEV__) {
      console.log('[IMAGE CLIENT] save success');
      console.log('[IMAGE CLIENT] exists=true');
    }

    return {
      uri: targetFile.uri,
      fingerprint,
    };
  } catch (error) {
    logImageClientSaveError(error);
    throw error;
  }
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
    const downloadedUris: { originalImageUri?: string; processedImageUri?: string } = {};

    if (__DEV__) {
      console.log(
        `[IMAGE RESTORE] item=${shortWardrobeItemId(serverItem.id)} processedAvailable=${serverItem.images.processedAvailable} originalAvailable=${serverItem.images.originalAvailable}`,
      );
    }

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
      let downloaded;

      try {
        downloaded = await downloadWardrobeProcessedImage(token, serverItem.id);
      } catch (error) {
        if (error instanceof AccountApiError && error.status === 0) {
          console.log('[IMAGE SYNC] offline');
          isOffline = true;
        } else {
          isPending = true;
        }
      }

      if (downloaded) {
        try {
          const saved = await saveDownloadedImage({
            userId,
            itemId: serverItem.id,
            kind: 'processed',
            bytes: downloaded.bytes,
            contentType: downloaded.contentType,
          });

          downloadedUris.processedImageUri = saved.uri;

          if (serverItem.images.processedUpdatedAt) {
            await updateSyncEntry({
              itemId: serverItem.id,
              kind: 'processed',
              localFingerprint: saved.fingerprint,
              serverUpdatedAt: serverItem.images.processedUpdatedAt,
            });
          }

          console.log('[IMAGE SYNC] download processed');
        } catch {
          isPending = true;
        }
      }
    }

    if (needsOriginalDownload) {
      let downloaded;

      try {
        downloaded = await downloadWardrobeOriginalImage(token, serverItem.id);
      } catch (error) {
        if (error instanceof AccountApiError && error.status === 0) {
          console.log('[IMAGE SYNC] offline');
          isOffline = true;
        } else {
          isPending = true;
        }
      }

      if (downloaded) {
        try {
          const saved = await saveDownloadedImage({
            userId,
            itemId: serverItem.id,
            kind: 'original',
            bytes: downloaded.bytes,
            contentType: downloaded.contentType,
          });

          downloadedUris.originalImageUri = saved.uri;

          if (serverItem.images.originalUpdatedAt) {
            await updateSyncEntry({
              itemId: serverItem.id,
              kind: 'original',
              localFingerprint: saved.fingerprint,
              serverUpdatedAt: serverItem.images.originalUpdatedAt,
            });
          }

          console.log('[IMAGE SYNC] download original');
        } catch {
          isPending = true;
        }
      }
    }

    const diskUris = await resolveImageUrisFromDisk(userId, serverItem.id, localItem);
    const resolvedUris = mergeDownloadedAndDiskImageUris(downloadedUris, diskUris);

    const imagePatch = buildSyncedImagePatch(localItem, resolvedUris);

    if (localItem) {
      if (shouldApplyResolvedImageUris(localItem, resolvedUris) && Object.keys(imagePatch).length > 0) {
        logImageApply(resolvedUris);
        handlers.applySyncedWardrobeItem({
          ...localItem,
          ...imagePatch,
        });
      }
    } else if (Object.keys(imagePatch).length > 0) {
      logImageApply(resolvedUris);
      handlers.applySyncedWardrobeItem(toRestoredWardrobeItem(serverItem, imagePatch));
      console.log('[IMAGE SYNC] restore item');
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
