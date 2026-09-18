import { getDatabase } from './database';

export type PhoneVerificationPurpose = 'link' | 'login';

export type DbPhoneVerificationChallenge = {
  id: string;
  user_id: string;
  phone: string;
  purpose: string;
  code_hash: string;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
  attempt_count: number;
  last_sent_at: string;
};

export function createPhoneVerificationChallenge({
  id,
  userId,
  phone,
  purpose,
  codeHash,
  expiresAt,
}: {
  id: string;
  userId: string;
  phone: string;
  purpose: PhoneVerificationPurpose;
  codeHash: string;
  expiresAt: string;
}): DbPhoneVerificationChallenge {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO phone_verification_challenges (
      id, user_id, phone, purpose, code_hash, created_at, expires_at, consumed_at, attempt_count, last_sent_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, ?)`,
  ).run(id, userId, phone, purpose, codeHash, now, expiresAt, now);

  const created = findPhoneVerificationChallengeById(id);

  if (!created) {
    throw new Error('Failed to create phone verification challenge.');
  }

  return created;
}

export function findPhoneVerificationChallengeById(
  challengeId: string,
): DbPhoneVerificationChallenge | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM phone_verification_challenges WHERE id = ?')
    .get(challengeId) as DbPhoneVerificationChallenge | undefined;

  return row ?? null;
}

export function getLatestChallengeForUserPhone({
  userId,
  phone,
  purpose,
}: {
  userId: string;
  phone: string;
  purpose: PhoneVerificationPurpose;
}): DbPhoneVerificationChallenge | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT * FROM phone_verification_challenges
       WHERE user_id = ? AND phone = ? AND purpose = ?
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(userId, phone, purpose) as DbPhoneVerificationChallenge | undefined;

  return row ?? null;
}

export function countRecentChallengesForUser({
  userId,
  sinceIso,
}: {
  userId: string;
  sinceIso: string;
}): number {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM phone_verification_challenges
       WHERE user_id = ? AND created_at >= ?`,
    )
    .get(userId, sinceIso) as { count: number };

  return row.count;
}

export function countRecentChallengesForPhone({
  phone,
  purpose,
  sinceIso,
}: {
  phone: string;
  purpose: PhoneVerificationPurpose;
  sinceIso: string;
}): number {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM phone_verification_challenges
       WHERE phone = ? AND purpose = ? AND created_at >= ?`,
    )
    .get(phone, purpose, sinceIso) as { count: number };

  return row.count;
}

export function incrementChallengeAttemptCount(
  challengeId: string,
): DbPhoneVerificationChallenge | null {
  const db = getDatabase();

  db.prepare(
    `UPDATE phone_verification_challenges
     SET attempt_count = attempt_count + 1
     WHERE id = ?`,
  ).run(challengeId);

  return findPhoneVerificationChallengeById(challengeId);
}

export function consumePhoneVerificationChallenge(challengeId: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE phone_verification_challenges
     SET consumed_at = ?
     WHERE id = ?`,
  ).run(now, challengeId);
}
