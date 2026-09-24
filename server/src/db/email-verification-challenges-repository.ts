import crypto from 'crypto';

import { getDatabase } from './database';

export type EmailVerificationPurpose = 'link' | 'login' | 'password_reset';

export type DbEmailVerificationChallenge = {
  id: string;
  user_id: string;
  email: string;
  purpose: string;
  code_hash: string;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
  attempt_count: number;
  last_sent_at: string;
};

export function createEmailVerificationChallenge({
  id,
  userId,
  email,
  purpose,
  codeHash,
  expiresAt,
}: {
  id: string;
  userId: string;
  email: string;
  purpose: EmailVerificationPurpose;
  codeHash: string;
  expiresAt: string;
}): DbEmailVerificationChallenge {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO email_verification_challenges (
      id, user_id, email, purpose, code_hash, created_at, expires_at, consumed_at, attempt_count, last_sent_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, ?)`,
  ).run(id, userId, email, purpose, codeHash, now, expiresAt, now);

  const created = findEmailVerificationChallengeById(id);

  if (!created) {
    throw new Error('Failed to create email verification challenge.');
  }

  return created;
}

export function findEmailVerificationChallengeById(
  challengeId: string,
): DbEmailVerificationChallenge | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM email_verification_challenges WHERE id = ?')
    .get(challengeId) as DbEmailVerificationChallenge | undefined;

  return row ?? null;
}

export function getLatestChallengeForUserEmail({
  userId,
  email,
  purpose,
}: {
  userId: string;
  email: string;
  purpose: EmailVerificationPurpose;
}): DbEmailVerificationChallenge | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT * FROM email_verification_challenges
       WHERE user_id = ? AND email = ? AND purpose = ?
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(userId, email, purpose) as DbEmailVerificationChallenge | undefined;

  return row ?? null;
}

export function countRecentChallengesForUser({
  userId,
  purpose,
  sinceIso,
}: {
  userId: string;
  purpose: EmailVerificationPurpose;
  sinceIso: string;
}): number {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM email_verification_challenges
       WHERE user_id = ? AND purpose = ? AND created_at >= ?`,
    )
    .get(userId, purpose, sinceIso) as { count: number };

  return row.count;
}

export function deleteEmailVerificationChallenge(challengeId: string): boolean {
  const db = getDatabase();
  const result = db
    .prepare('DELETE FROM email_verification_challenges WHERE id = ?')
    .run(challengeId);

  return result.changes > 0;
}

export function countRecentChallengesForEmail({
  email,
  purpose,
  sinceIso,
}: {
  email: string;
  purpose: EmailVerificationPurpose;
  sinceIso: string;
}): number {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM email_verification_challenges
       WHERE email = ? AND purpose = ? AND created_at >= ?`,
    )
    .get(email, purpose, sinceIso) as { count: number };

  return row.count;
}

export function getLatestChallengeForEmail({
  email,
  purpose,
}: {
  email: string;
  purpose: EmailVerificationPurpose;
}): DbEmailVerificationChallenge | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT * FROM email_verification_challenges
       WHERE email = ? AND purpose = ?
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(email, purpose) as DbEmailVerificationChallenge | undefined;

  return row ?? null;
}

export function incrementChallengeAttemptCount(challengeId: string): DbEmailVerificationChallenge | null {
  const db = getDatabase();

  db.prepare(
    `UPDATE email_verification_challenges
     SET attempt_count = attempt_count + 1
     WHERE id = ?`,
  ).run(challengeId);

  return findEmailVerificationChallengeById(challengeId);
}

export function consumeEmailVerificationChallenge(challengeId: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE email_verification_challenges
     SET consumed_at = ?
     WHERE id = ?`,
  ).run(now, challengeId);
}
