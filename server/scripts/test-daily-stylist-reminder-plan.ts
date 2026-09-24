import {
  buildReminderStateWhenDailyStylistDisabled,
  isDailyStylistScheduleCorrect,
  parseDailyStylistTime,
  resolveDailyStylistReminderAction,
  shouldClearReminderStateOnAccountCleanup,
  shouldSyncDeviceTimeZone,
} from '../../src/utils/daily-stylist-reminder-plan';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function testParseDailyStylistTime(): void {
  assert(parseDailyStylistTime('09:00')?.hour === 9, '09:00 hour');
  assert(parseDailyStylistTime('09:00')?.minute === 0, '09:00 minute');
  assert(parseDailyStylistTime('24:00') === null, 'invalid hour');
  assert(parseDailyStylistTime('09:60') === null, 'invalid minute');
  assert(parseDailyStylistTime('9:00') === null, 'missing leading zero');
}

function testResolveDailyStylistReminderAction(): void {
  assert(
    resolveDailyStylistReminderAction({
      dailyStylistEnabled: false,
      reminderEnabled: true,
      permissionGranted: true,
      dailyStylistTime: '09:00',
      hasCorrectSchedule: true,
      hasScheduledNotification: true,
    }) === 'cancel',
    'daily off cancels existing schedule',
  );

  assert(
    resolveDailyStylistReminderAction({
      dailyStylistEnabled: true,
      reminderEnabled: false,
      permissionGranted: true,
      dailyStylistTime: '09:00',
      hasCorrectSchedule: false,
      hasScheduledNotification: false,
    }) === 'none',
    'reminder off keeps schedule absent',
  );

  assert(
    resolveDailyStylistReminderAction({
      dailyStylistEnabled: true,
      reminderEnabled: true,
      permissionGranted: false,
      dailyStylistTime: '09:00',
      hasCorrectSchedule: true,
      hasScheduledNotification: true,
    }) === 'cancel',
    'permission revoked cancels schedule',
  );

  assert(
    resolveDailyStylistReminderAction({
      dailyStylistEnabled: true,
      reminderEnabled: true,
      permissionGranted: true,
      dailyStylistTime: '09:00',
      hasCorrectSchedule: true,
      hasScheduledNotification: true,
    }) === 'none',
    'correct schedule is noop',
  );

  assert(
    resolveDailyStylistReminderAction({
      dailyStylistEnabled: true,
      reminderEnabled: true,
      permissionGranted: true,
      dailyStylistTime: '10:00',
      hasCorrectSchedule: false,
      hasScheduledNotification: true,
    }) === 'schedule',
    'wrong time reschedules',
  );
}

function testTimezoneHelpers(): void {
  assert(shouldSyncDeviceTimeZone('Europe/Moscow', 'Europe/Moscow') === false, 'same timezone');
  assert(shouldSyncDeviceTimeZone('Europe/Moscow', 'Asia/Tokyo') === true, 'different timezone');
  assert(shouldSyncDeviceTimeZone('Europe/Moscow', null) === false, 'missing device timezone');
}

function testScheduleMatch(): void {
  const parsed = parseDailyStylistTime('09:00');

  assert(parsed !== null, 'parsed time exists');
  assert(
    isDailyStylistScheduleCorrect({ type: 'daily', hour: 9, minute: 0 }, parsed) === true,
    'matches daily trigger',
  );
  assert(
    isDailyStylistScheduleCorrect({ type: 'daily', hour: 10, minute: 0 }, parsed) === false,
    'rejects wrong trigger',
  );
}

function testAccountCleanupFlag(): void {
  assert(shouldClearReminderStateOnAccountCleanup() === true, 'account cleanup clears reminder');
}

function testDailyDisabledClearsReminderState(): void {
  const disabledFromSync = buildReminderStateWhenDailyStylistDisabled({
    dailyStylistReminderEnabled: true,
    scheduledNotificationId: 'wardrobe-ai.daily-stylist-reminder',
  });

  assert(disabledFromSync.nextState.dailyStylistReminderEnabled === false, 'sync off disables reminder');
  assert(disabledFromSync.nextState.scheduledNotificationId === null, 'sync off clears schedule id');
  assert(disabledFromSync.shouldPersist === true, 'sync off persists cleared reminder state');

  const disabledWithoutSchedule = buildReminderStateWhenDailyStylistDisabled({
    dailyStylistReminderEnabled: true,
    scheduledNotificationId: null,
  });

  assert(
    disabledWithoutSchedule.nextState.dailyStylistReminderEnabled === false,
    'sync off clears reminder even without schedule id',
  );
  assert(disabledWithoutSchedule.shouldPersist === true, 'reminder true requires persist on daily off');

  const alreadyDisabled = buildReminderStateWhenDailyStylistDisabled({
    dailyStylistReminderEnabled: false,
    scheduledNotificationId: null,
  });

  assert(alreadyDisabled.shouldPersist === false, 'already disabled reminder needs no persist');

  assert(
    resolveDailyStylistReminderAction({
      dailyStylistEnabled: true,
      reminderEnabled: false,
      permissionGranted: true,
      dailyStylistTime: '09:00',
      hasCorrectSchedule: false,
      hasScheduledNotification: false,
    }) === 'none',
    'daily back on does not auto schedule reminder',
  );
}

function main(): void {
  testParseDailyStylistTime();
  testResolveDailyStylistReminderAction();
  testTimezoneHelpers();
  testScheduleMatch();
  testAccountCleanupFlag();
  testDailyDisabledClearsReminderState();
  console.log('All daily-stylist-reminder-plan checks passed.');
}

main();
