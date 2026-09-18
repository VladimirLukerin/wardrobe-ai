import { getDatabase } from './database';
import { findWardrobeItemRow } from './wardrobe-items-repository';

export type WardrobeItemImagesMetadata = {
  originalAvailable: boolean;
  processedAvailable: boolean;
  originalUpdatedAt: string | null;
  processedUpdatedAt: string | null;
};

export function getWardrobeItemImagesMetadata(
  userId: string,
  itemId: string,
): WardrobeItemImagesMetadata | null {
  const row = findWardrobeItemRow(userId, itemId);

  if (!row || row.deleted_at !== null) {
    return null;
  }

  return {
    originalAvailable: Boolean(row.original_image_key),
    processedAvailable: Boolean(row.processed_image_key),
    originalUpdatedAt: row.original_image_updated_at,
    processedUpdatedAt: row.processed_image_updated_at,
  };
}

export function assertOwnedWardrobeItem(userId: string, itemId: string) {
  const row = findWardrobeItemRow(userId, itemId);

  if (!row || row.deleted_at !== null) {
    return null;
  }

  return row;
}

export function updateWardrobeOriginalImage({
  userId,
  itemId,
  storageKey,
  contentType,
  uploadedAt,
}: {
  userId: string;
  itemId: string;
  storageKey: string;
  contentType: string;
  uploadedAt: string;
}): void {
  const db = getDatabase();

  db.prepare(
    `UPDATE wardrobe_items
     SET original_image_key = ?,
         original_image_content_type = ?,
         original_image_updated_at = ?,
         updated_at = ?
     WHERE user_id = ? AND item_id = ? AND deleted_at IS NULL`,
  ).run(storageKey, contentType, uploadedAt, uploadedAt, userId, itemId);
}

export function updateWardrobeProcessedImage({
  userId,
  itemId,
  storageKey,
  contentType,
  uploadedAt,
}: {
  userId: string;
  itemId: string;
  storageKey: string;
  contentType: string;
  uploadedAt: string;
}): void {
  const db = getDatabase();

  db.prepare(
    `UPDATE wardrobe_items
     SET processed_image_key = ?,
         processed_image_content_type = ?,
         processed_image_updated_at = ?,
         updated_at = ?
     WHERE user_id = ? AND item_id = ? AND deleted_at IS NULL`,
  ).run(storageKey, contentType, uploadedAt, uploadedAt, userId, itemId);
}

export function getWardrobeImageRecord(
  userId: string,
  itemId: string,
  kind: 'original' | 'processed',
): { key: string; contentType: string | null } | null {
  const row = assertOwnedWardrobeItem(userId, itemId);

  if (!row) {
    return null;
  }

  if (kind === 'original') {
    if (!row.original_image_key) {
      return null;
    }

    return {
      key: row.original_image_key,
      contentType: row.original_image_content_type,
    };
  }

  if (!row.processed_image_key) {
    return null;
  }

  return {
    key: row.processed_image_key,
    contentType: row.processed_image_content_type,
  };
}
