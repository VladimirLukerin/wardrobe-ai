import {
  getDailySuggestFallbackSkipReason,
  shouldUseDailySuggestFallback,
} from '../../src/utils/daily-ai-fallback-policy';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function testProviderFailureBlocksSuggestFallback(): void {
  assert(
    shouldUseDailySuggestFallback({
      isServerAccount: true,
      dailyStylistEnabled: true,
      dailyProviderAttempted: true,
    }) === false,
    'Provider failure should block suggest fallback',
  );
  assert(
    getDailySuggestFallbackSkipReason({
      isServerAccount: true,
      dailyStylistEnabled: true,
      dailyProviderAttempted: true,
    }) === 'provider_failure',
    'Expected provider_failure skip reason',
  );
  console.log('OK provider failure blocks suggest fallback');
}

function testDailyStylistEnabledBlocksSuggestFallback(): void {
  assert(
    shouldUseDailySuggestFallback({
      isServerAccount: true,
      dailyStylistEnabled: true,
      dailyProviderAttempted: false,
    }) === false,
    'Daily stylist server path should not use suggest fallback',
  );
  assert(
    getDailySuggestFallbackSkipReason({
      isServerAccount: true,
      dailyStylistEnabled: true,
      dailyProviderAttempted: false,
    }) === 'daily_stylist_enabled',
    'Expected daily_stylist_enabled skip reason',
  );
  console.log('OK daily stylist enabled blocks suggest fallback');
}

function testLegacySuggestFallbackStillAllowed(): void {
  assert(
    shouldUseDailySuggestFallback({
      isServerAccount: false,
      dailyStylistEnabled: false,
      dailyProviderAttempted: false,
    }),
    'Non-server accounts may still use suggest fallback',
  );
  assert(
    shouldUseDailySuggestFallback({
      isServerAccount: true,
      dailyStylistEnabled: false,
      dailyProviderAttempted: false,
    }),
    'Server account with daily disabled may still use suggest fallback',
  );
  console.log('OK legacy suggest fallback still allowed when daily path inactive');
}

function testProvider429Scenario(): void {
  const skipReason = getDailySuggestFallbackSkipReason({
    isServerAccount: true,
    dailyStylistEnabled: true,
    dailyProviderAttempted: true,
  });

  assert(skipReason === 'provider_failure', '429 after daily attempt should map to provider_failure skip');
  console.log('OK provider 429 scenario skips suggest fallback');
}

function testMissingOutfitWithoutSecondProvider(): void {
  assert(
    !shouldUseDailySuggestFallback({
      isServerAccount: true,
      dailyStylistEnabled: true,
      dailyProviderAttempted: true,
    }),
    'Missing outfit after failed daily attempt must not trigger suggest fallback',
  );
  console.log('OK missing outfit does not trigger second provider call');
}

function main(): void {
  testProviderFailureBlocksSuggestFallback();
  testDailyStylistEnabledBlocksSuggestFallback();
  testLegacySuggestFallbackStillAllowed();
  testProvider429Scenario();
  testMissingOutfitWithoutSecondProvider();
  console.log('All daily suggest fallback policy tests passed.');
}

main();
