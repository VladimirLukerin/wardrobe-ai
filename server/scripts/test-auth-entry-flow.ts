import {
  handleAuthLoginPress,
  resetAuthEntrySheets,
  shouldResetAuthEntrySheetsOnSessionChange,
} from '../../src/utils/auth-entry-flow';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function testLoginPressOpensSheet(): void {
  const next = handleAuthLoginPress({
    isLoginChoiceVisible: false,
    showAuthSplash: true,
  });

  assert(next.isLoginChoiceVisible, 'Login press should open choice sheet');
  console.log('OK login press opens sheet');
}

function testSessionChangeResetsSheets(): void {
  assert(
    shouldResetAuthEntrySheetsOnSessionChange('session-a', 'session-b'),
    'Different session keys should reset auth entry sheets',
  );
  assert(
    !shouldResetAuthEntrySheetsOnSessionChange('session-a', 'session-a'),
    'Same session key should not reset auth entry sheets',
  );
  console.log('OK session change reset semantics');
}

function testResetSheetsClosesLogin(): void {
  const next = resetAuthEntrySheets({
    isLoginChoiceVisible: true,
    showAuthSplash: true,
  });

  assert(!next.isLoginChoiceVisible, 'Reset should close login sheet');
  console.log('OK reset closes login sheet');
}

function main(): void {
  testLoginPressOpensSheet();
  testSessionChangeResetsSheets();
  testResetSheetsClosesLogin();
  console.log('All auth entry flow tests passed.');
}

main();
