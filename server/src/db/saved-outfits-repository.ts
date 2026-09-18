import { getDatabase } from './database';
import type {
  ValidatedSavedOutfitDeleteInput,
  ValidatedSavedOutfitInput,
} from './validate-saved-outfit';

export type DbSavedOutfit = {
  user_id: string;
  outfit_id: string;
  title: string;
  description: string;
  source: string | null;
  item_ids_json: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SavedOutfitResponse = {
  id: string;
  title: string;
  description: string;
  source: 'manual' | 'ai' | null;
  itemIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type SavedOutfitDeletedResponse = {
  id: string;
  deletedAt: string;
};

export type SavedOutfitsSnapshotResponse = {
  outfits: SavedOutfitResponse[];
  deletedOutfits: SavedOutfitDeletedResponse[];
  serverTime: string;
};

function parseSource(value: string | null): 'manual' | 'ai' | null {
  if (value === 'manual' || value === 'ai') {
    return value;
  }

  return null;
}

function toOutfitResponse(row: DbSavedOutfit): SavedOutfitResponse {
  let itemIds: string[] = [];

  try {
    const parsed = JSON.parse(row.item_ids_json);

    if (Array.isArray(parsed)) {
      itemIds = parsed.filter((entry): entry is string => typeof entry === 'string');
    }
  } catch {
    itemIds = [];
  }

  return {
    id: row.outfit_id,
    title: row.title,
    description: row.description,
    source: parseSource(row.source),
    itemIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getSavedOutfitsSnapshot(userId: string): SavedOutfitsSnapshotResponse {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM saved_outfits WHERE user_id = ?')
    .all(userId) as DbSavedOutfit[];

  const outfits = rows.filter((row) => row.deleted_at === null).map(toOutfitResponse);
  const deletedOutfits = rows
    .filter((row) => row.deleted_at !== null)
    .map((row) => ({
      id: row.outfit_id,
      deletedAt: row.deleted_at as string,
    }));

  return {
    outfits,
    deletedOutfits,
    serverTime: new Date().toISOString(),
  };
}

export function getActiveSavedOutfitsForUser(userId: string): SavedOutfitResponse[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT *
       FROM saved_outfits
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
    )
    .all(userId) as DbSavedOutfit[];

  return rows.map(toOutfitResponse);
}

export function getSavedOutfitById(userId: string, outfitId: string): SavedOutfitResponse | null {
  const row = findSavedOutfitRow(userId, outfitId);

  if (!row || row.deleted_at !== null) {
    return null;
  }

  return toOutfitResponse(row);
}

export function findSavedOutfitRow(userId: string, outfitId: string): DbSavedOutfit | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM saved_outfits WHERE user_id = ? AND outfit_id = ?')
    .get(userId, outfitId) as DbSavedOutfit | undefined;

  return row ?? null;
}

export function upsertSavedOutfit(
  userId: string,
  outfit: ValidatedSavedOutfitInput,
): SavedOutfitResponse {
  const db = getDatabase();
  const existing = findSavedOutfitRow(userId, outfit.id);

  if (
    existing &&
    existing.deleted_at === null &&
    new Date(existing.updated_at).getTime() > new Date(outfit.clientUpdatedAt).getTime()
  ) {
    return toOutfitResponse(existing);
  }

  const createdAt = existing?.created_at ?? outfit.createdAt;
  const nextUpdatedAt = outfit.clientUpdatedAt;

  db.prepare(
    `INSERT INTO saved_outfits (
      user_id, outfit_id, title, description, source, item_ids_json,
      created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
    ON CONFLICT(user_id, outfit_id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      source = excluded.source,
      item_ids_json = excluded.item_ids_json,
      updated_at = excluded.updated_at,
      deleted_at = NULL`,
  ).run(
    userId,
    outfit.id,
    outfit.title,
    outfit.description,
    outfit.source,
    JSON.stringify(outfit.itemIds),
    createdAt,
    nextUpdatedAt,
  );

  const updated = findSavedOutfitRow(userId, outfit.id);

  if (!updated || updated.deleted_at !== null) {
    throw new Error('Failed to upsert saved outfit.');
  }

  return toOutfitResponse(updated);
}

export function markSavedOutfitDeleted(
  userId: string,
  input: ValidatedSavedOutfitDeleteInput,
): SavedOutfitDeletedResponse {
  const db = getDatabase();
  const existing = findSavedOutfitRow(userId, input.id);

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
  const itemIdsJson = existing?.item_ids_json ?? JSON.stringify([]);

  db.prepare(
    `INSERT INTO saved_outfits (
      user_id, outfit_id, title, description, source, item_ids_json,
      created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, outfit_id) DO UPDATE SET
      deleted_at = excluded.deleted_at,
      updated_at = excluded.updated_at`,
  ).run(
    userId,
    input.id,
    existing?.title ?? 'Deleted outfit',
    existing?.description ?? '',
    existing?.source ?? null,
    itemIdsJson,
    createdAt,
    nextDeletedAt,
    nextDeletedAt,
  );

  return {
    id: input.id,
    deletedAt: nextDeletedAt,
  };
}

export function syncSavedOutfits({
  userId,
  outfits,
  deletedOutfits,
}: {
  userId: string;
  outfits: ValidatedSavedOutfitInput[];
  deletedOutfits: ValidatedSavedOutfitDeleteInput[];
}): SavedOutfitsSnapshotResponse {
  for (const outfit of outfits) {
    upsertSavedOutfit(userId, outfit);
  }

  for (const deletedOutfit of deletedOutfits) {
    markSavedOutfitDeleted(userId, deletedOutfit);
  }

  return getSavedOutfitsSnapshot(userId);
}
