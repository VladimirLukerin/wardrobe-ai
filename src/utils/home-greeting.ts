const TECHNICAL_NAME_PATTERN = /^[0-9a-f-]{20,}$/i;

export function resolveHomeDisplayName(
  displayName: string | null | undefined,
  profileHydrated: boolean,
): string | null {
  if (!profileHydrated) {
    return null;
  }

  const trimmed = (displayName ?? '').trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.includes('@')) {
    return null;
  }

  if (TECHNICAL_NAME_PATTERN.test(trimmed)) {
    return null;
  }

  const lowered = trimmed.toLowerCase();
  if (lowered === 'undefined' || lowered === 'null') {
    return null;
  }

  return trimmed;
}

export function formatHomeGreetingLine(
  displayName: string | null | undefined,
  profileHydrated: boolean,
): string {
  const name = resolveHomeDisplayName(displayName, profileHydrated);

  if (name) {
    return `Привет, ${name}!`;
  }

  return 'Привет!';
}
