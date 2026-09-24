const TECHNICAL_NAME_PATTERN = /^[0-9a-f-]{20,}$/i;

/** Legacy placeholder written into fresh local profiles before scoping fix. */
export const LEGACY_HOME_GREETING_PLACEHOLDER = 'Владимир';

export type ResolveHomeDisplayNameOptions = {
  isProtectedAccount: boolean;
};

export function resolveHomeDisplayName(
  displayName: string | null | undefined,
  profileHydrated: boolean,
  options: ResolveHomeDisplayNameOptions,
): string | null {
  if (!profileHydrated) {
    return null;
  }

  const trimmed = (displayName ?? '').trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (
    !options.isProtectedAccount &&
    trimmed.localeCompare(LEGACY_HOME_GREETING_PLACEHOLDER, 'ru') === 0
  ) {
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
  options: ResolveHomeDisplayNameOptions,
): string {
  const name = resolveHomeDisplayName(displayName, profileHydrated, options);

  if (name) {
    return `Привет, ${name}!`;
  }

  return 'Привет!';
}
