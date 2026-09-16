const LOCAL_USER_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LOCAL_USER_ID_SUFFIX_LENGTH = 6;

function getRandomValues(length: number): Uint8Array {
  const bytes = new Uint8Array(length);

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    try {
      globalThis.crypto.getRandomValues(bytes);
      return bytes;
    } catch {
      // Fall through to non-cryptographic fallback below.
    }
  }

  // NOT for security-sensitive identifiers — local UI placeholder only.
  const seed = Date.now();

  for (let index = 0; index < length; index += 1) {
    bytes[index] = Math.floor((seed + index * 9973 + Math.random() * 256) % 256);
  }

  return bytes;
}

function buildLocalUserIdFromValues(randomValues: Uint8Array): string {
  let suffix = '';

  for (const value of randomValues) {
    suffix += LOCAL_USER_ID_ALPHABET[value % LOCAL_USER_ID_ALPHABET.length];
  }

  return `WA-${suffix}`;
}

function buildFallbackLocalUserId(): string {
  // NOT for security-sensitive identifiers — last-resort local UI placeholder only.
  const randomValues = new Uint8Array(LOCAL_USER_ID_SUFFIX_LENGTH);
  const seed = Date.now();

  for (let index = 0; index < LOCAL_USER_ID_SUFFIX_LENGTH; index += 1) {
    randomValues[index] = Math.floor((seed + index * 7919 + Math.random() * 256) % 256);
  }

  return buildLocalUserIdFromValues(randomValues);
}

export function generateLocalUserId(): string {
  try {
    return buildLocalUserIdFromValues(getRandomValues(LOCAL_USER_ID_SUFFIX_LENGTH));
  } catch {
    return buildFallbackLocalUserId();
  }
}

export function isValidLocalUserId(value: string): boolean {
  return /^WA-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(value);
}
