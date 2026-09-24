import { parsePhoneNumberFromString } from 'libphonenumber-js';

export type NormalizedPhoneResult =
  | { ok: true; phone: string }
  | { ok: false; reason: 'empty' | 'invalid' };

export function normalizePhone(raw: unknown): NormalizedPhoneResult {
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'empty' };
  }

  const trimmed = raw.trim();

  if (!trimmed) {
    return { ok: false, reason: 'empty' };
  }

  const parsed = parsePhoneNumberFromString(trimmed);

  if (!parsed || !parsed.isValid()) {
    return { ok: false, reason: 'invalid' };
  }

  return { ok: true, phone: parsed.format('E.164') };
}
