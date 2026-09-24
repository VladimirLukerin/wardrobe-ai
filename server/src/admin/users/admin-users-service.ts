import type { DbUser } from '../../db/users-repository';
import { findUserById, findUserByPublicId } from '../../db/users-repository';
import { getPreferencesResponse } from '../../db/user-preferences-repository';
import { getDatabase } from '../../db/database';

export type AccountType = 'guest' | 'protected';

export function resolveAccountType(user: DbUser): AccountType {
  return user.email_verified === 1 || user.phone_verified === 1 ? 'protected' : 'guest';
}

export type AdminUserListRow = {
  id: string;
  publicId: string;
  accountType: AccountType;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
  wardrobeCount: number;
  savedOutfitCount: number;
  familyMemberCount: number;
};

export type AdminUserListResult = {
  items: AdminUserListRow[];
  nextCursor: string | null;
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

type UserListCursor = {
  createdAt: string;
  id: string;
};

function encodeCursor(cursor: UserListCursor): string {
  return Buffer.from(`${cursor.createdAt}|${cursor.id}`, 'utf8').toString('base64url');
}

function decodeCursor(raw: string | undefined): UserListCursor | null {
  if (!raw?.trim()) {
    return null;
  }

  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const separatorIndex = decoded.lastIndexOf('|');

    if (separatorIndex <= 0) {
      return null;
    }

    return {
      createdAt: decoded.slice(0, separatorIndex),
      id: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function parseLimit(raw: unknown): number {
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(String(raw), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

function buildAccountTypeFilter(accountType: unknown): { clause: string; params: unknown[] } {
  if (accountType === 'guest') {
    return {
      clause: 'AND u.email_verified = 0 AND u.phone_verified = 0',
      params: [],
    };
  }

  if (accountType === 'protected') {
    return {
      clause: 'AND (u.email_verified = 1 OR u.phone_verified = 1)',
      params: [],
    };
  }

  return { clause: '', params: [] };
}

function buildSearchFilter(query: unknown): { clause: string; params: unknown[] } {
  if (typeof query !== 'string' || !query.trim()) {
    return { clause: '', params: [] };
  }

  const trimmed = query.trim();
  const normalizedPublicId = trimmed.toUpperCase();
  const normalizedEmail = trimmed.toLowerCase();

  return {
    clause: `AND (
      u.public_id = ?
      OR u.public_id LIKE ?
      OR (u.email IS NOT NULL AND u.email_verified = 1 AND u.email = ?)
    )`,
    params: [normalizedPublicId, `${normalizedPublicId}%`, normalizedEmail],
  };
}

type AdminUserListQuery = {
  q?: unknown;
  accountType?: unknown;
  limit?: unknown;
  cursor?: unknown;
};

export function listAdminUsers(filters: AdminUserListQuery): AdminUserListResult {
  const limit = parseLimit(filters.limit);
  const cursor = decodeCursor(typeof filters.cursor === 'string' ? filters.cursor : undefined);
  const accountTypeFilter = buildAccountTypeFilter(filters.accountType);
  const searchFilter = buildSearchFilter(filters.q);

  const whereParts = ['WHERE 1=1', accountTypeFilter.clause, searchFilter.clause];
  const params: unknown[] = [...accountTypeFilter.params, ...searchFilter.params];

  if (cursor) {
    whereParts.push('AND (u.created_at < ? OR (u.created_at = ? AND u.id < ?))');
    params.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }

  const sql = `
    SELECT
      u.id,
      u.public_id,
      u.email_verified,
      u.phone_verified,
      u.created_at,
      u.updated_at,
      (
        SELECT COUNT(*)
        FROM wardrobe_items wi
        WHERE wi.user_id = u.id AND wi.deleted_at IS NULL
      ) AS wardrobe_count,
      (
        SELECT COUNT(*)
        FROM saved_outfits so
        WHERE so.user_id = u.id AND so.deleted_at IS NULL
      ) AS saved_outfit_count,
      (
        SELECT COUNT(*)
        FROM family_members fm
        WHERE fm.user_id = u.id
      ) AS family_member_count
    FROM users u
    ${whereParts.join('\n')}
    ORDER BY u.created_at DESC, u.id DESC
    LIMIT ?
  `;

  params.push(limit + 1);

  const db = getDatabase();
  const rows = db.prepare(sql).all(...params) as Array<{
    id: string;
    public_id: string;
    email_verified: number;
    phone_verified: number;
    created_at: string;
    updated_at: string;
    wardrobe_count: number;
    saved_outfit_count: number;
    family_member_count: number;
  }>;

  const pageRows = rows.slice(0, limit);
  const items: AdminUserListRow[] = pageRows.map((row) => ({
    id: row.id,
    publicId: row.public_id,
    accountType: row.email_verified === 1 || row.phone_verified === 1 ? 'protected' : 'guest',
    emailVerified: row.email_verified === 1,
    phoneVerified: row.phone_verified === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    wardrobeCount: row.wardrobe_count,
    savedOutfitCount: row.saved_outfit_count,
    familyMemberCount: row.family_member_count,
  }));

  const nextCursor =
    rows.length > limit
      ? encodeCursor({
          createdAt: pageRows[pageRows.length - 1].created_at,
          id: pageRows[pageRows.length - 1].id,
        })
      : null;

  return { items, nextCursor };
}

export function resolveAdminUserTarget(userIdParam: string): DbUser | null {
  const byId = findUserById(userIdParam);

  if (byId) {
    return byId;
  }

  return findUserByPublicId(userIdParam);
}

export function getAdminUserCounts(userId: string): {
  wardrobeCount: number;
  savedOutfitCount: number;
  wearEventCount: number;
  familyMemberCount: number;
} {
  const db = getDatabase();

  const wardrobeCount = (
    db
      .prepare('SELECT COUNT(*) AS count FROM wardrobe_items WHERE user_id = ? AND deleted_at IS NULL')
      .get(userId) as { count: number }
  ).count;

  const savedOutfitCount = (
    db
      .prepare('SELECT COUNT(*) AS count FROM saved_outfits WHERE user_id = ? AND deleted_at IS NULL')
      .get(userId) as { count: number }
  ).count;

  const wearEventCount = (
    db
      .prepare('SELECT COUNT(*) AS count FROM wear_events WHERE user_id = ? AND deleted_at IS NULL')
      .get(userId) as { count: number }
  ).count;

  const familyMemberCount = (
    db.prepare('SELECT COUNT(*) AS count FROM family_members WHERE user_id = ?').get(userId) as {
      count: number;
    }
  ).count;

  return {
    wardrobeCount,
    savedOutfitCount,
    wearEventCount,
    familyMemberCount,
  };
}

export function getAdminUserDetail(userIdParam: string) {
  const user = resolveAdminUserTarget(userIdParam);

  if (!user) {
    return null;
  }

  const counts = getAdminUserCounts(user.id);
  const preferences = getPreferencesResponse(user.id);
  const stylist = preferences.stylistPreferences;
  const body = preferences.bodyParameters;

  return {
    account: {
      id: user.id,
      publicId: user.public_id,
      accountType: resolveAccountType(user),
      displayName: user.display_name,
      emailVerified: user.email_verified === 1,
      phoneVerified: user.phone_verified === 1,
      hasVerifiedEmailOnFile: user.email_verified === 1 && Boolean(user.email),
      hasVerifiedPhoneOnFile: user.phone_verified === 1 && Boolean(user.phone),
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    },
    counts,
    settings: {
      dailyStylistEnabled: stylist?.dailyStylistEnabled ?? null,
      dailyStylistTime: stylist?.dailyStylistTime ?? null,
      timezone: stylist?.timezone ?? null,
      bodyLocationMode: body?.locationMode ?? null,
      preferencesUpdatedAt: preferences.updatedAt,
    },
  };
}

export function listAdminUserWardrobe(userIdParam: string, limitRaw: unknown, cursorRaw: unknown) {
  const user = resolveAdminUserTarget(userIdParam);

  if (!user) {
    return null;
  }

  const limit = parseLimit(limitRaw);
  const cursor = decodeCursor(typeof cursorRaw === 'string' ? cursorRaw : undefined);
  const db = getDatabase();

  const params: unknown[] = [user.id];
  let cursorClause = 'AND deleted_at IS NULL';

  if (cursor) {
    cursorClause =
      'AND deleted_at IS NULL AND (created_at < ? OR (created_at = ? AND item_id < ?))';
    params.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }

  params.push(limit + 1);

  const rows = db
    .prepare(
      `SELECT item_id, category, color, is_favorite, created_at, updated_at,
              original_image_key, processed_image_key
       FROM wardrobe_items
       WHERE user_id = ?
       ${cursorClause}
       ORDER BY created_at DESC, item_id DESC
       LIMIT ?`,
    )
    .all(...params) as Array<{
    item_id: string;
    category: string;
    color: string;
    is_favorite: number;
    created_at: string;
    updated_at: string;
    original_image_key: string | null;
    processed_image_key: string | null;
  }>;

  const pageRows = rows.slice(0, limit);
  const items = pageRows.map((row) => ({
    id: row.item_id,
    category: row.category,
    color: row.color,
    isFavorite: row.is_favorite === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasOriginalImage: Boolean(row.original_image_key),
    hasProcessedImage: Boolean(row.processed_image_key),
  }));

  const nextCursor =
    rows.length > limit
      ? encodeCursor({
          createdAt: pageRows[pageRows.length - 1].created_at,
          id: pageRows[pageRows.length - 1].item_id,
        })
      : null;

  return { userId: user.id, items, nextCursor };
}

export function listAdminUserOutfits(userIdParam: string, limitRaw: unknown, cursorRaw: unknown) {
  const user = resolveAdminUserTarget(userIdParam);

  if (!user) {
    return null;
  }

  const limit = parseLimit(limitRaw);
  const cursor = decodeCursor(typeof cursorRaw === 'string' ? cursorRaw : undefined);
  const db = getDatabase();
  const params: unknown[] = [user.id];
  let cursorClause = 'AND deleted_at IS NULL';

  if (cursor) {
    cursorClause =
      'AND deleted_at IS NULL AND (created_at < ? OR (created_at = ? AND outfit_id < ?))';
    params.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }

  params.push(limit + 1);

  const rows = db
    .prepare(
      `SELECT outfit_id, title, source, created_at, updated_at, item_ids_json
       FROM saved_outfits
       WHERE user_id = ?
       ${cursorClause}
       ORDER BY created_at DESC, outfit_id DESC
       LIMIT ?`,
    )
    .all(...params) as Array<{
    outfit_id: string;
    title: string;
    source: string | null;
    created_at: string;
    updated_at: string;
    item_ids_json: string;
  }>;

  const pageRows = rows.slice(0, limit);
  const items = pageRows.map((row) => {
    let itemCount = 0;

    try {
      const parsed = JSON.parse(row.item_ids_json) as unknown;
      itemCount = Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      itemCount = 0;
    }

    return {
      id: row.outfit_id,
      title: row.title,
      source: row.source,
      itemCount,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  const nextCursor =
    rows.length > limit
      ? encodeCursor({
          createdAt: pageRows[pageRows.length - 1].created_at,
          id: pageRows[pageRows.length - 1].outfit_id,
        })
      : null;

  return { userId: user.id, items, nextCursor };
}

export function listAdminUserWearHistory(userIdParam: string, limitRaw: unknown, cursorRaw: unknown) {
  const user = resolveAdminUserTarget(userIdParam);

  if (!user) {
    return null;
  }

  const limit = parseLimit(limitRaw);
  const cursor = decodeCursor(typeof cursorRaw === 'string' ? cursorRaw : undefined);
  const db = getDatabase();
  const params: unknown[] = [user.id];
  let cursorClause = 'AND deleted_at IS NULL';

  if (cursor) {
    cursorClause =
      'AND deleted_at IS NULL AND (worn_at < ? OR (worn_at = ? AND event_id < ?))';
    params.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }

  params.push(limit + 1);

  const rows = db
    .prepare(
      `SELECT event_id, outfit_id, worn_at, created_at, updated_at
       FROM wear_events
       WHERE user_id = ?
       ${cursorClause}
       ORDER BY worn_at DESC, event_id DESC
       LIMIT ?`,
    )
    .all(...params) as Array<{
    event_id: string;
    outfit_id: string;
    worn_at: string;
    created_at: string;
    updated_at: string;
  }>;

  const pageRows = rows.slice(0, limit);
  const items = pageRows.map((row) => ({
    id: row.event_id,
    outfitId: row.outfit_id,
    wornAt: row.worn_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const nextCursor =
    rows.length > limit
      ? encodeCursor({
          createdAt: pageRows[pageRows.length - 1].worn_at,
          id: pageRows[pageRows.length - 1].event_id,
        })
      : null;

  return { userId: user.id, items, nextCursor };
}

export function listAdminUserFamily(userIdParam: string, limitRaw: unknown, cursorRaw: unknown) {
  const user = resolveAdminUserTarget(userIdParam);

  if (!user) {
    return null;
  }

  const limit = parseLimit(limitRaw);
  const cursor = decodeCursor(typeof cursorRaw === 'string' ? cursorRaw : undefined);
  const db = getDatabase();
  const params: unknown[] = [user.id];
  let cursorClause = '';

  if (cursor) {
    cursorClause = 'AND (fm.created_at < ? OR (fm.created_at = ? AND fm.member_user_id < ?))';
    params.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }

  params.push(limit + 1);

  const rows = db
    .prepare(
      `SELECT fm.member_user_id, fm.created_at, u.public_id AS member_public_id
       FROM family_members fm
       INNER JOIN users u ON u.id = fm.member_user_id
       WHERE fm.user_id = ?
       ${cursorClause}
       ORDER BY fm.created_at DESC, fm.member_user_id DESC
       LIMIT ?`,
    )
    .all(...params) as Array<{
    member_user_id: string;
    member_public_id: string;
    created_at: string;
  }>;

  const pageRows = rows.slice(0, limit);
  const items = pageRows.map((row) => ({
    memberUserId: row.member_user_id,
    memberPublicId: row.member_public_id,
    linkedAt: row.created_at,
  }));

  const nextCursor =
    rows.length > limit
      ? encodeCursor({
          createdAt: pageRows[pageRows.length - 1].created_at,
          id: pageRows[pageRows.length - 1].member_user_id,
        })
      : null;

  return { userId: user.id, items, nextCursor };
}

export { decodeCursor as decodeAdminListCursorForTests, encodeCursor as encodeAdminListCursorForTests };
