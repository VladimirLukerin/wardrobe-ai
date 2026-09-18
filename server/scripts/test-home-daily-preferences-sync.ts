import {
  canMutateServerDailyOutfit,
  shouldAttemptDailyCreateOrRegenerate,
} from '../../src/utils/home-daily-preferences-sync';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function testCanMutateServerDailyOutfit(): void {
  assert(canMutateServerDailyOutfit(false, 'synced') === false, 'guest account cannot mutate');
  assert(canMutateServerDailyOutfit(true, 'idle') === false, 'idle blocks mutation');
  assert(canMutateServerDailyOutfit(true, 'syncing') === false, 'syncing blocks mutation');
  assert(canMutateServerDailyOutfit(true, 'pending') === false, 'pending blocks mutation');
  assert(canMutateServerDailyOutfit(true, 'offline') === false, 'offline blocks mutation');
  assert(canMutateServerDailyOutfit(true, 'synced') === true, 'synced allows mutation');
}

function testShouldAttemptDailyCreateOrRegenerate(): void {
  assert(
    shouldAttemptDailyCreateOrRegenerate(true, true, 'idle') === false,
    'local daily true before sync does not mutate',
  );
  assert(
    shouldAttemptDailyCreateOrRegenerate(true, true, 'synced') === true,
    'synced server daily true can mutate',
  );
  assert(
    shouldAttemptDailyCreateOrRegenerate(false, true, 'synced') === false,
    'synced server daily false does not mutate',
  );
}

function main(): void {
  testCanMutateServerDailyOutfit();
  testShouldAttemptDailyCreateOrRegenerate();
  console.log('All home-daily-preferences-sync checks passed.');
}

main();
