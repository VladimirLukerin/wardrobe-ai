import { randomUUID } from 'node:crypto';

import { getDatabase } from './database';
import type { OutfitFeedbackRating, OutfitFeedbackReason } from './outfit-feedback-reasons';

export type OutfitFeedbackResponse = {
  id: string;
  recommendationKey: string;
  itemIds: string[];
  rating: OutfitFeedbackRating;
  reason: OutfitFeedbackReason | null;
  createdAt: string;
  updatedAt: string;
};

type OutfitFeedbackRow = {
  feedback_id: string;
  user_id: string;
  recommendation_key: string;
  item_ids_json: string;
  rating: OutfitFeedbackRating;
  reason: OutfitFeedbackReason | null;
  created_at: string;
  updated_at: string;
};

const RECENT_FEEDBACK_LIMIT = 30;

function parseItemIdsJson(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((itemId): itemId is string => typeof itemId === 'string');
  } catch {
    return [];
  }
}

function mapRow(row: OutfitFeedbackRow): OutfitFeedbackResponse {
  return {
    id: row.feedback_id,
    recommendationKey: row.recommendation_key,
    itemIds: parseItemIdsJson(row.item_ids_json),
    rating: row.rating,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function upsertOutfitFeedback({
  userId,
  recommendationKey,
  itemIds,
  rating,
  reason,
}: {
  userId: string;
  recommendationKey: string;
  itemIds: string[];
  rating: OutfitFeedbackRating;
  reason: OutfitFeedbackReason | null;
}): OutfitFeedbackResponse {
  const db = getDatabase();
  const now = new Date().toISOString();
  const existing = db
    .prepare(
      `SELECT feedback_id, user_id, recommendation_key, item_ids_json, rating, reason, created_at, updated_at
       FROM outfit_feedback
       WHERE user_id = ? AND recommendation_key = ?`,
    )
    .get(userId, recommendationKey) as OutfitFeedbackRow | undefined;

  const feedbackId = existing?.feedback_id ?? randomUUID();
  const createdAt = existing?.created_at ?? now;
  const itemIdsJson = JSON.stringify(itemIds);

  db.prepare(
    `INSERT INTO outfit_feedback (
      feedback_id, user_id, recommendation_key, item_ids_json, rating, reason, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, recommendation_key) DO UPDATE SET
      item_ids_json = excluded.item_ids_json,
      rating = excluded.rating,
      reason = excluded.reason,
      updated_at = excluded.updated_at`,
  ).run(feedbackId, userId, recommendationKey, itemIdsJson, rating, reason, createdAt, now);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[OUTFIT FEEDBACK] rating=${rating} reason=${reason ?? 'none'}`);
  }

  return {
    id: feedbackId,
    recommendationKey,
    itemIds,
    rating,
    reason,
    createdAt,
    updatedAt: now,
  };
}

export function getOutfitFeedbackForKey(
  userId: string,
  recommendationKey: string,
): OutfitFeedbackResponse | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT feedback_id, user_id, recommendation_key, item_ids_json, rating, reason, created_at, updated_at
       FROM outfit_feedback
       WHERE user_id = ? AND recommendation_key = ?`,
    )
    .get(userId, recommendationKey) as OutfitFeedbackRow | undefined;

  return row ? mapRow(row) : null;
}

export function getRecentOutfitFeedback(userId: string, limit = RECENT_FEEDBACK_LIMIT): OutfitFeedbackResponse[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT feedback_id, user_id, recommendation_key, item_ids_json, rating, reason, created_at, updated_at
       FROM outfit_feedback
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT ?`,
    )
    .all(userId, limit) as OutfitFeedbackRow[];

  return rows.map(mapRow);
}
