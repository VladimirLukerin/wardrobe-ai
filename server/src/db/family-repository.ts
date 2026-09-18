import crypto from 'crypto';

import { getDatabase } from './database';
import { isValidPublicId } from './public-id';
import { findUserByPublicId } from './users-repository';

export type FamilyMemberInfo = {
  publicId: string;
  displayName: string | null;
};

export type FamilyInviteInfo = {
  id: string;
  sender: FamilyMemberInfo;
  createdAt: string;
};

export type OutgoingFamilyInviteInfo = {
  id: string;
  recipient: FamilyMemberInfo;
  createdAt: string;
};

export type FamilyOperationError = {
  status: number;
  message: string;
};

function toFamilyMemberInfo(publicId: string, displayName: string | null): FamilyMemberInfo {
  return { publicId, displayName };
}

export function areFamilyMembers(userId: string, memberUserId: string): boolean {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT 1 AS found
       FROM family_members
       WHERE user_id = ? AND member_user_id = ?`,
    )
    .get(userId, memberUserId) as { found: number } | undefined;

  return row?.found === 1;
}

function shortMemberPublicId(publicId: string): string {
  return publicId.slice(0, 8);
}

function logFamilyAccessDenied(memberPublicId: string): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log(`[FAMILY ACCESS] denied member=${shortMemberPublicId(memberPublicId)}`);
}

export function resolveFamilyMemberWardrobeAccess(
  currentUserId: string,
  memberPublicId: string,
): { ok: true; targetUserId: string; member: FamilyMemberInfo } | FamilyOperationError {
  const trimmedPublicId = memberPublicId.trim();

  if (!isValidPublicId(trimmedPublicId)) {
    return { status: 400, message: 'Некорректный ID пользователя.' };
  }

  const member = findUserByPublicId(trimmedPublicId);

  if (!member) {
    return { status: 404, message: 'Пользователь не найден.' };
  }

  if (member.id === currentUserId) {
    logFamilyAccessDenied(trimmedPublicId);
    return { status: 403, message: 'Нельзя просматривать свой гардероб через этот endpoint.' };
  }

  if (!areFamilyMembers(currentUserId, member.id)) {
    logFamilyAccessDenied(trimmedPublicId);
    return { status: 403, message: 'Доступ к гардеробу недоступен.' };
  }

  return {
    ok: true,
    targetUserId: member.id,
    member: toFamilyMemberInfo(member.public_id, member.display_name),
  };
}

function hasPendingInvite(senderUserId: string, recipientUserId: string): boolean {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT 1 AS found
       FROM family_invites
       WHERE sender_user_id = ?
         AND recipient_user_id = ?
         AND status = 'pending'`,
    )
    .get(senderUserId, recipientUserId) as { found: number } | undefined;

  return row?.found === 1;
}

export function listFamilyMembers(userId: string): FamilyMemberInfo[] {
  const db = getDatabase();

  const rows = db
    .prepare(
      `SELECT u.public_id, u.display_name
       FROM family_members fm
       INNER JOIN users u ON u.id = fm.member_user_id
       WHERE fm.user_id = ?
       ORDER BY fm.created_at ASC`,
    )
    .all(userId) as Array<{ public_id: string; display_name: string | null }>;

  return rows.map((row) => toFamilyMemberInfo(row.public_id, row.display_name));
}

export function listIncomingPendingInvites(userId: string): FamilyInviteInfo[] {
  const db = getDatabase();

  const rows = db
    .prepare(
      `SELECT fi.id, fi.created_at, u.public_id, u.display_name
       FROM family_invites fi
       INNER JOIN users u ON u.id = fi.sender_user_id
       WHERE fi.recipient_user_id = ?
         AND fi.status = 'pending'
       ORDER BY fi.created_at ASC`,
    )
    .all(userId) as Array<{
    id: string;
    created_at: string;
    public_id: string;
    display_name: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    sender: toFamilyMemberInfo(row.public_id, row.display_name),
  }));
}

export function listOutgoingPendingInvites(userId: string): OutgoingFamilyInviteInfo[] {
  const db = getDatabase();

  const rows = db
    .prepare(
      `SELECT fi.id, fi.created_at, u.public_id, u.display_name
       FROM family_invites fi
       INNER JOIN users u ON u.id = fi.recipient_user_id
       WHERE fi.sender_user_id = ?
         AND fi.status = 'pending'
       ORDER BY fi.created_at ASC`,
    )
    .all(userId) as Array<{
    id: string;
    created_at: string;
    public_id: string;
    display_name: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    recipient: toFamilyMemberInfo(row.public_id, row.display_name),
  }));
}

export function createFamilyInvite(
  senderUserId: string,
  recipientPublicId: string,
): { invite: OutgoingFamilyInviteInfo } | FamilyOperationError {
  const trimmedPublicId = recipientPublicId.trim();

  if (!isValidPublicId(trimmedPublicId)) {
    return { status: 400, message: 'Некорректный ID пользователя.' };
  }

  const recipient = findUserByPublicId(trimmedPublicId);

  if (!recipient) {
    return { status: 404, message: 'Пользователь с таким ID не найден.' };
  }

  if (recipient.id === senderUserId) {
    return { status: 400, message: 'Нельзя добавить самого себя в семью.' };
  }

  if (areFamilyMembers(senderUserId, recipient.id) || areFamilyMembers(recipient.id, senderUserId)) {
    return { status: 409, message: 'Этот пользователь уже в вашей семье.' };
  }

  if (hasPendingInvite(senderUserId, recipient.id)) {
    return { status: 409, message: 'Приглашение этому пользователю уже отправлено.' };
  }

  if (hasPendingInvite(recipient.id, senderUserId)) {
    return {
      status: 409,
      message: 'Этот пользователь уже отправил вам приглашение. Примите его в профиле.',
    };
  }

  const db = getDatabase();
  const now = new Date().toISOString();
  const inviteId = crypto.randomUUID();

  db.prepare(
    `INSERT INTO family_invites (
      id, sender_user_id, recipient_user_id, status, created_at, updated_at
    ) VALUES (?, ?, ?, 'pending', ?, ?)`,
  ).run(inviteId, senderUserId, recipient.id, now, now);

  if (process.env.NODE_ENV !== 'production') {
    console.log('[FAMILY] invite created');
  }

  return {
    invite: {
      id: inviteId,
      createdAt: now,
      recipient: toFamilyMemberInfo(recipient.public_id, recipient.display_name),
    },
  };
}

export function acceptFamilyInvite(
  recipientUserId: string,
  inviteId: string,
): { ok: true } | FamilyOperationError {
  const db = getDatabase();
  const now = new Date().toISOString();

  const invite = db
    .prepare(
      `SELECT id, sender_user_id, recipient_user_id, status
       FROM family_invites
       WHERE id = ?`,
    )
    .get(inviteId) as
    | {
        id: string;
        sender_user_id: string;
        recipient_user_id: string;
        status: string;
      }
    | undefined;

  if (!invite) {
    return { status: 404, message: 'Приглашение не найдено.' };
  }

  if (invite.recipient_user_id !== recipientUserId) {
    return { status: 403, message: 'Недостаточно прав для этого действия.' };
  }

  if (invite.status !== 'pending') {
    return { status: 409, message: 'Это приглашение уже обработано.' };
  }

  if (
    areFamilyMembers(invite.sender_user_id, invite.recipient_user_id) ||
    areFamilyMembers(invite.recipient_user_id, invite.sender_user_id)
  ) {
    return { status: 409, message: 'Вы уже состоите в семье с этим пользователем.' };
  }

  const acceptInvite = db.transaction(() => {
    const updated = db
      .prepare(
        `UPDATE family_invites
         SET status = 'accepted', updated_at = ?
         WHERE id = ? AND status = 'pending'`,
      )
      .run(now, inviteId);

    if (updated.changes !== 1) {
      throw new Error('INVITE_ALREADY_PROCESSED');
    }

    db.prepare(
      `INSERT INTO family_members (user_id, member_user_id, created_at)
       VALUES (?, ?, ?)`,
    ).run(invite.sender_user_id, invite.recipient_user_id, now);

    db.prepare(
      `INSERT INTO family_members (user_id, member_user_id, created_at)
       VALUES (?, ?, ?)`,
    ).run(invite.recipient_user_id, invite.sender_user_id, now);
  });

  try {
    acceptInvite();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message === 'INVITE_ALREADY_PROCESSED') {
      return { status: 409, message: 'Это приглашение уже обработано.' };
    }

    throw error;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[FAMILY] invite accepted');
  }

  return { ok: true };
}

export function rejectFamilyInvite(
  recipientUserId: string,
  inviteId: string,
): { ok: true } | FamilyOperationError {
  const db = getDatabase();
  const now = new Date().toISOString();

  const invite = db
    .prepare(
      `SELECT id, recipient_user_id, status
       FROM family_invites
       WHERE id = ?`,
    )
    .get(inviteId) as
    | {
        id: string;
        recipient_user_id: string;
        status: string;
      }
    | undefined;

  if (!invite) {
    return { status: 404, message: 'Приглашение не найдено.' };
  }

  if (invite.recipient_user_id !== recipientUserId) {
    return { status: 403, message: 'Недостаточно прав для этого действия.' };
  }

  if (invite.status !== 'pending') {
    return { status: 409, message: 'Это приглашение уже обработано.' };
  }

  const updated = db
    .prepare(
      `UPDATE family_invites
       SET status = 'rejected', updated_at = ?
       WHERE id = ? AND status = 'pending'`,
    )
    .run(now, inviteId);

  if (updated.changes !== 1) {
    return { status: 409, message: 'Это приглашение уже обработано.' };
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[FAMILY] invite rejected');
  }

  return { ok: true };
}

export function removeFamilyMember(
  userId: string,
  memberPublicId: string,
): { ok: true } | FamilyOperationError {
  const trimmedPublicId = memberPublicId.trim();

  if (!isValidPublicId(trimmedPublicId)) {
    return { status: 400, message: 'Некорректный ID пользователя.' };
  }

  const member = findUserByPublicId(trimmedPublicId);

  if (!member) {
    return { status: 404, message: 'Пользователь не найден.' };
  }

  if (member.id === userId) {
    return { status: 400, message: 'Нельзя удалить самого себя из семьи.' };
  }

  if (!areFamilyMembers(userId, member.id)) {
    return { status: 404, message: 'Этот пользователь не состоит в вашей семье.' };
  }

  const db = getDatabase();

  db.transaction(() => {
    db.prepare(
      `DELETE FROM family_members
       WHERE user_id = ? AND member_user_id = ?`,
    ).run(userId, member.id);

    db.prepare(
      `DELETE FROM family_members
       WHERE user_id = ? AND member_user_id = ?`,
    ).run(member.id, userId);
  })();

  if (process.env.NODE_ENV !== 'production') {
    console.log('[FAMILY] member removed');
  }

  return { ok: true };
}
