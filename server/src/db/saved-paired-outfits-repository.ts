import crypto from 'crypto';

import { getDatabase } from './database';
import { areFamilyMembers } from './family-repository';
import { findUserById } from './users-repository';

export type DbSavedPairedOutfit = {
  owner_user_id: string;
  paired_outfit_id: string;
  member_user_id: string;
  member_public_id: string;
  member_display_name: string | null;
  occasion: string;
  matching_mode: string;
  owner_item_ids_json: string;
  member_item_ids_json: string;
  explanation: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SavedPairedOutfitResponse = {
  id: string;
  member: {
    publicId: string;
    displayName: string | null;
    accessAvailable: boolean;
  };
  occasion: string;
  matchingMode: string;
  ownerItemIds: string[];
  memberItemIds: string[];
  explanation: string;
  createdAt: string;
  updatedAt: string;
};

const MATCHING_MODES = ['natural', 'same_style', 'colors', 'photo'] as const;

export type SavedPairedOutfitMatchingMode = (typeof MATCHING_MODES)[number];

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

function toResponse(row: DbSavedPairedOutfit, ownerUserId: string): SavedPairedOutfitResponse {
  return {
    id: row.paired_outfit_id,
    member: {
      publicId: row.member_public_id,
      displayName: row.member_display_name,
      accessAvailable: areFamilyMembers(ownerUserId, row.member_user_id),
    },
    occasion: row.occasion,
    matchingMode: row.matching_mode,
    ownerItemIds: parseItemIds(row.owner_item_ids_json),
    memberItemIds: parseItemIds(row.member_item_ids_json),
    explanation: row.explanation,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function isSavedPairedOutfitMatchingMode(value: string): value is SavedPairedOutfitMatchingMode {
  return MATCHING_MODES.includes(value as SavedPairedOutfitMatchingMode);
}

export function listSavedPairedOutfits(ownerUserId: string): SavedPairedOutfitResponse[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT *
       FROM saved_paired_outfits
       WHERE owner_user_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
    )
    .all(ownerUserId) as DbSavedPairedOutfit[];

  return rows.map((row) => toResponse(row, ownerUserId));
}

export function getSavedPairedOutfitById(
  ownerUserId: string,
  pairedOutfitId: string,
): SavedPairedOutfitResponse | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT *
       FROM saved_paired_outfits
       WHERE owner_user_id = ? AND paired_outfit_id = ? AND deleted_at IS NULL`,
    )
    .get(ownerUserId, pairedOutfitId) as DbSavedPairedOutfit | undefined;

  if (!row) {
    return null;
  }

  return toResponse(row, ownerUserId);
}

export function createSavedPairedOutfit({
  ownerUserId,
  memberUserId,
  memberPublicId,
  memberDisplayName,
  occasion,
  matchingMode,
  ownerItemIds,
  memberItemIds,
  explanation,
}: {
  ownerUserId: string;
  memberUserId: string;
  memberPublicId: string;
  memberDisplayName: string | null;
  occasion: string;
  matchingMode: SavedPairedOutfitMatchingMode;
  ownerItemIds: string[];
  memberItemIds: string[];
  explanation: string;
}): SavedPairedOutfitResponse {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  db.prepare(
    `INSERT INTO saved_paired_outfits (
      owner_user_id, paired_outfit_id, member_user_id, member_public_id,
      member_display_name, occasion, matching_mode, owner_item_ids_json,
      member_item_ids_json, explanation, created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
  ).run(
    ownerUserId,
    id,
    memberUserId,
    memberPublicId,
    memberDisplayName,
    occasion.trim(),
    matchingMode,
    JSON.stringify(ownerItemIds),
    JSON.stringify(memberItemIds),
    explanation.trim(),
    now,
    now,
  );

  const created = getSavedPairedOutfitById(ownerUserId, id);

  if (!created) {
    throw new Error('Failed to create saved paired outfit.');
  }

  return created;
}

export function deleteSavedPairedOutfit(ownerUserId: string, pairedOutfitId: string): boolean {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `UPDATE saved_paired_outfits
       SET deleted_at = ?, updated_at = ?
       WHERE owner_user_id = ? AND paired_outfit_id = ? AND deleted_at IS NULL`,
    )
    .run(now, now, ownerUserId, pairedOutfitId);

  return result.changes > 0;
}

export function getMemberSnapshot(memberUserId: string): {
  publicId: string;
  displayName: string | null;
} | null {
  const member = findUserById(memberUserId);

  if (!member) {
    return null;
  }

  return {
    publicId: member.public_id,
    displayName: member.display_name,
  };
}
