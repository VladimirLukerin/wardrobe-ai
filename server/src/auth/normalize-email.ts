const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NormalizedEmailResult =
  | { ok: true; email: string }
  | { ok: false; reason: 'empty' | 'invalid' | 'too_long' };

export function normalizeEmail(raw: unknown): NormalizedEmailResult {
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'empty' };
  }

  const trimmed = raw.trim();

  if (!trimmed) {
    return { ok: false, reason: 'empty' };
  }

  const email = trimmed.toLowerCase();

  if (email.length > MAX_EMAIL_LENGTH) {
    return { ok: false, reason: 'too_long' };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, reason: 'invalid' };
  }

  return { ok: true, email };
}
