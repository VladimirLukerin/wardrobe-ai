const PUBLIC_ID_PATTERN = /^WA-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

export function isValidPublicId(value: string): boolean {
  return PUBLIC_ID_PATTERN.test(value);
}
