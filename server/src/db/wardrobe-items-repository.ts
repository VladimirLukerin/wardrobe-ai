import { getDatabase } from './database';
import type {
  ValidatedWardrobeDeleteInput,
  ValidatedWardrobeItemInput,
} from './validate-wardrobe-item';

export type DbWardrobeItem = {
  user_id: string;
  item_id: string;
  name: string;
  base_name: string;
  category: string;
  color: string;
  pattern: string;
  print_description: string | null;
  style: string;
  is_favorite: number;
  image_processing_status: string | null;
  original_image_key: string | null;
  processed_image_key: string | null;
  original_image_updated_at: string | null;
  processed_image_updated_at: string | null;
  original_image_content_type: string | null;
  processed_image_content_type: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type WardrobeItemImagesResponse = {
  originalAvailable: boolean;
  processedAvailable: boolean;
  originalUpdatedAt: string | null;
  processedUpdatedAt: string | null;
};

export type WardrobeItemResponse = {
  id: string;
  name: string;
  baseName: string;
  category: string;
  color: string;
  pattern: string;
  printDescription: string | null;
  style: string;
  isFavorite: boolean;
  imageProcessingStatus: string | null;
  images: WardrobeItemImagesResponse;
  updatedAt: string;
};

export type WardrobeDeletedItemResponse = {
  id: string;
  deletedAt: string;
};

export type WardrobeSnapshotResponse = {
  items: WardrobeItemResponse[];
  deletedItems: WardrobeDeletedItemResponse[];
  serverTime: string;
};

export type FamilyWardrobeItemResponse = WardrobeItemResponse & {
  createdAt: string;
};

function toItemResponse(row: DbWardrobeItem): WardrobeItemResponse {
  return {
    id: row.item_id,
    name: row.name,
    baseName: row.base_name,
    category: row.category,
    color: row.color,
    pattern: row.pattern,
    printDescription: row.print_description,
    style: row.style,
    isFavorite: row.is_favorite === 1,
    imageProcessingStatus: row.image_processing_status,
    images: {
      originalAvailable: Boolean(row.original_image_key),
      processedAvailable: Boolean(row.processed_image_key),
      originalUpdatedAt: row.original_image_updated_at,
      processedUpdatedAt: row.processed_image_updated_at,
    },
    updatedAt: row.updated_at,
  };
}

export function getWardrobeSnapshot(userId: string): WardrobeSnapshotResponse {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM wardrobe_items WHERE user_id = ?')
    .all(userId) as DbWardrobeItem[];

  const items = rows.filter((row) => row.deleted_at === null).map(toItemResponse);
  const deletedItems = rows
    .filter((row) => row.deleted_at !== null)
    .map((row) => ({
      id: row.item_id,
      deletedAt: row.deleted_at as string,
    }));

  return {
    items,
    deletedItems,
    serverTime: new Date().toISOString(),
  };
}

export function getActiveWardrobeItemsForUser(userId: string): FamilyWardrobeItemResponse[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT *
       FROM wardrobe_items
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
    )
    .all(userId) as DbWardrobeItem[];

  return rows.map((row) => ({
    ...toItemResponse(row),
    createdAt: row.created_at,
  }));
}

export function findWardrobeItemRow(userId: string, itemId: string): DbWardrobeItem | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM wardrobe_items WHERE user_id = ? AND item_id = ?')
    .get(userId, itemId) as DbWardrobeItem | undefined;

  return row ?? null;
}

export function verifyActiveItemIdsForUser(userId: string, itemIds: string[]): boolean {
  if (itemIds.length === 0) {
    return false;
  }

  const uniqueIds = [...new Set(itemIds)];
  const db = getDatabase();
  const placeholders = uniqueIds.map(() => '?').join(', ');
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM wardrobe_items
       WHERE user_id = ? AND deleted_at IS NULL AND item_id IN (${placeholders})`,
    )
    .get(userId, ...uniqueIds) as { count: number };

  return row.count === uniqueIds.length;
}

export function upsertWardrobeItem(
  userId: string,
  item: ValidatedWardrobeItemInput,
): WardrobeItemResponse {
  const db = getDatabase();
  const existing = findWardrobeItemRow(userId, item.id);

  if (
    existing &&
    existing.deleted_at === null &&
    new Date(existing.updated_at).getTime() > new Date(item.clientUpdatedAt).getTime()
  ) {
    return toItemResponse(existing);
  }

  const now = new Date().toISOString();
  const createdAt = existing?.created_at ?? now;
  const nextUpdatedAt = item.clientUpdatedAt;

  db.prepare(
    `INSERT INTO wardrobe_items (
      user_id, item_id, name, base_name, category, color, pattern,
      print_description, style, is_favorite, image_processing_status,
      created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    ON CONFLICT(user_id, item_id) DO UPDATE SET
      name = excluded.name,
      base_name = excluded.base_name,
      category = excluded.category,
      color = excluded.color,
      pattern = excluded.pattern,
      print_description = excluded.print_description,
      style = excluded.style,
      is_favorite = excluded.is_favorite,
      image_processing_status = excluded.image_processing_status,
      updated_at = excluded.updated_at,
      deleted_at = NULL`,
  ).run(
    userId,
    item.id,
    item.name,
    item.baseName,
    item.category,
    item.color,
    item.pattern,
    item.printDescription,
    item.style,
    item.isFavorite ? 1 : 0,
    item.imageProcessingStatus,
    createdAt,
    nextUpdatedAt,
  );

  const updated = findWardrobeItemRow(userId, item.id);

  if (!updated || updated.deleted_at !== null) {
    throw new Error('Failed to upsert wardrobe item.');
  }

  return toItemResponse(updated);
}

export function markWardrobeItemDeleted(
  userId: string,
  input: ValidatedWardrobeDeleteInput,
): WardrobeDeletedItemResponse {
  const db = getDatabase();
  const existing = findWardrobeItemRow(userId, input.id);

  if (
    existing?.deleted_at &&
    new Date(existing.deleted_at).getTime() > new Date(input.clientDeletedAt).getTime()
  ) {
    return {
      id: input.id,
      deletedAt: existing.deleted_at,
    };
  }

  const now = new Date().toISOString();
  const createdAt = existing?.created_at ?? now;
  const nextDeletedAt = input.clientDeletedAt;

  db.prepare(
    `INSERT INTO wardrobe_items (
      user_id, item_id, name, base_name, category, color, pattern,
      print_description, style, is_favorite, image_processing_status,
      created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, item_id) DO UPDATE SET
      deleted_at = excluded.deleted_at,
      updated_at = excluded.updated_at`,
  ).run(
    userId,
    input.id,
    existing?.name ?? 'Deleted item',
    existing?.base_name ?? 'Deleted item',
    existing?.category ?? 'Другое',
    existing?.color ?? 'Не определён',
    existing?.pattern ?? 'Без принта',
    existing?.print_description ?? null,
    existing?.style ?? 'Универсальный',
    existing?.is_favorite ?? 0,
    existing?.image_processing_status ?? null,
    createdAt,
    nextDeletedAt,
    nextDeletedAt,
  );

  return {
    id: input.id,
    deletedAt: nextDeletedAt,
  };
}

export function syncWardrobeItems({
  userId,
  items,
  deletedItems,
}: {
  userId: string;
  items: ValidatedWardrobeItemInput[];
  deletedItems: ValidatedWardrobeDeleteInput[];
}): WardrobeSnapshotResponse {
  for (const item of items) {
    upsertWardrobeItem(userId, item);
  }

  for (const deletedItem of deletedItems) {
    markWardrobeItemDeleted(userId, deletedItem);
  }

  return getWardrobeSnapshot(userId);
}
