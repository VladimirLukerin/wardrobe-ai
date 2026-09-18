import { getDatabase } from './database';
import type {
  ValidatedWearEventDeleteInput,
  ValidatedWearEventInput,
} from './validate-wear-event';

export type DbWearEvent = {
  user_id: string;
  event_id: string;
  outfit_id: string;
  item_ids_json: string;
  worn_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type WearEventResponse = {
  id: string;
  outfitId: string;
  itemIds: string[];
  wornAt: string;
  updatedAt: string;
};

export type WearEventDeletedResponse = {
  id: string;
  deletedAt: string;
};

export type WearHistorySnapshotResponse = {
  events: WearEventResponse[];
  deletedEvents: WearEventDeletedResponse[];
  serverTime: string;
};

function parseItemIds(value: string): string[] {
  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === 'string');
    }
  } catch {
    // Ignore malformed JSON.
  }

  return [];
}

function toEventResponse(row: DbWearEvent): WearEventResponse {
  return {
    id: row.event_id,
    outfitId: row.outfit_id,
    itemIds: parseItemIds(row.item_ids_json),
    wornAt: row.worn_at,
    updatedAt: row.updated_at,
  };
}

export function getWearHistorySnapshot(userId: string): WearHistorySnapshotResponse {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM wear_events WHERE user_id = ?')
    .all(userId) as DbWearEvent[];

  const events = rows.filter((row) => row.deleted_at === null).map(toEventResponse);
  const deletedEvents = rows
    .filter((row) => row.deleted_at !== null)
    .map((row) => ({
      id: row.event_id,
      deletedAt: row.deleted_at as string,
    }));

  return {
    events,
    deletedEvents,
    serverTime: new Date().toISOString(),
  };
}

export function getRecentWearEventsForUser(userId: string, limit = 30): WearEventResponse[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT * FROM wear_events
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY worn_at DESC
       LIMIT ?`,
    )
    .all(userId, limit) as DbWearEvent[];

  return rows.map(toEventResponse);
}

export function getWearEventById(userId: string, eventId: string): WearEventResponse | null {
  const row = findWearEventRow(userId, eventId);

  if (!row || row.deleted_at !== null) {
    return null;
  }

  return toEventResponse(row);
}

export function findWearEventRow(userId: string, eventId: string): DbWearEvent | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM wear_events WHERE user_id = ? AND event_id = ?')
    .get(userId, eventId) as DbWearEvent | undefined;

  return row ?? null;
}

export function upsertWearEvent(
  userId: string,
  event: ValidatedWearEventInput,
): WearEventResponse {
  const db = getDatabase();
  const existing = findWearEventRow(userId, event.id);

  if (
    existing &&
    existing.deleted_at === null &&
    new Date(existing.updated_at).getTime() > new Date(event.clientUpdatedAt).getTime()
  ) {
    return toEventResponse(existing);
  }

  const createdAt = existing?.created_at ?? event.wornAt;
  const nextUpdatedAt = event.clientUpdatedAt;

  db.prepare(
    `INSERT INTO wear_events (
      user_id, event_id, outfit_id, item_ids_json, worn_at,
      created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    ON CONFLICT(user_id, event_id) DO UPDATE SET
      outfit_id = excluded.outfit_id,
      item_ids_json = excluded.item_ids_json,
      worn_at = excluded.worn_at,
      updated_at = excluded.updated_at,
      deleted_at = NULL`,
  ).run(
    userId,
    event.id,
    event.outfitId,
    JSON.stringify(event.itemIds),
    event.wornAt,
    createdAt,
    nextUpdatedAt,
  );

  const updated = findWearEventRow(userId, event.id);

  if (!updated || updated.deleted_at !== null) {
    throw new Error('Failed to upsert wear event.');
  }

  return toEventResponse(updated);
}

export function markWearEventDeleted(
  userId: string,
  input: ValidatedWearEventDeleteInput,
): WearEventDeletedResponse {
  const db = getDatabase();
  const existing = findWearEventRow(userId, input.id);

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
    `INSERT INTO wear_events (
      user_id, event_id, outfit_id, item_ids_json, worn_at,
      created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, event_id) DO UPDATE SET
      deleted_at = excluded.deleted_at,
      updated_at = excluded.updated_at`,
  ).run(
    userId,
    input.id,
    existing?.outfit_id ?? 'deleted-outfit',
    itemIdsJson,
    existing?.worn_at ?? nextDeletedAt,
    createdAt,
    nextDeletedAt,
    nextDeletedAt,
  );

  return {
    id: input.id,
    deletedAt: nextDeletedAt,
  };
}

export function syncWearEvents({
  userId,
  events,
  deletedEvents,
}: {
  userId: string;
  events: ValidatedWearEventInput[];
  deletedEvents: ValidatedWearEventDeleteInput[];
}): WearHistorySnapshotResponse {
  for (const event of events) {
    upsertWearEvent(userId, event);
  }

  for (const deletedEvent of deletedEvents) {
    markWearEventDeleted(userId, deletedEvent);
  }

  return getWearHistorySnapshot(userId);
}
