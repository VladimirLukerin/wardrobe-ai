import assert from 'node:assert/strict';

const LEGACY_HOME_GREETING_PLACEHOLDER = 'Владимир';

function resolveHomeDisplayName(displayName, profileHydrated, options) {
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

  return trimmed;
}

function formatHomeGreetingLine(displayName, profileHydrated, options) {
  const name = resolveHomeDisplayName(displayName, profileHydrated, options);
  return name ? `Привет, ${name}!` : 'Привет!';
}

assert.equal(
  formatHomeGreetingLine('Владимир', true, { isProtectedAccount: false }),
  'Привет!',
);
assert.equal(
  formatHomeGreetingLine('Владимир', true, { isProtectedAccount: true }),
  'Привет, Владимир!',
);
assert.equal(formatHomeGreetingLine('', true, { isProtectedAccount: false }), 'Привет!');
assert.equal(
  formatHomeGreetingLine('Мария', true, { isProtectedAccount: false }),
  'Привет, Мария!',
);
assert.equal(formatHomeGreetingLine('Владимир', false, { isProtectedAccount: false }), 'Привет!');

console.log('home-greeting tests passed');
