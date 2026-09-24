import crypto from 'crypto';

const PUBLIC_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PUBLIC_ID_SUFFIX_LENGTH = 8;

export function generatePublicId(): string {
  const bytes = crypto.randomBytes(PUBLIC_ID_SUFFIX_LENGTH);
  let suffix = '';

  for (const byte of bytes) {
    suffix += PUBLIC_ID_ALPHABET[byte % PUBLIC_ID_ALPHABET.length];
  }

  return `WA-${suffix}`;
}

export function isValidPublicId(value: string): boolean {
  return /^WA-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(value);
}
