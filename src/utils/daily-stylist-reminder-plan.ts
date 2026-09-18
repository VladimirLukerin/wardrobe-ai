export type ParsedDailyStylistTime = {
  hour: number;
  minute: number;
};

export type DailyStylistReminderReconcileAction = 'none' | 'cancel' | 'schedule';

export function parseDailyStylistTime(time: string): ParsedDailyStylistTime | null {
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }

  const [hourRaw, minuteRaw] = time.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour, minute };
}

export function getDeviceTimeZone(): string | null {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return typeof timeZone === 'string' && timeZone.trim().length > 0 ? timeZone : null;
  } catch {
    return null;
  }
}

export function isValidIanaTimeZone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function shouldSyncDeviceTimeZone(storedTimeZone: string, deviceTimeZone: string | null): boolean {
  if (!deviceTimeZone || !isValidIanaTimeZone(deviceTimeZone)) {
    return false;
  }

  return storedTimeZone.trim() !== deviceTimeZone;
}

type DailyTriggerLike = {
  type?: string;
  hour?: number;
  minute?: number;
};

export function isDailyStylistScheduleCorrect(
  trigger: unknown,
  parsedTime: ParsedDailyStylistTime,
): boolean {
  if (!trigger || typeof trigger !== 'object') {
    return false;
  }

  const dailyTrigger = trigger as DailyTriggerLike;

  return (
    dailyTrigger.type === 'daily' &&
    dailyTrigger.hour === parsedTime.hour &&
    dailyTrigger.minute === parsedTime.minute
  );
}

export function resolveDailyStylistReminderAction({
  dailyStylistEnabled,
  reminderEnabled,
  permissionGranted,
  dailyStylistTime,
  hasCorrectSchedule,
  hasScheduledNotification,
}: {
  dailyStylistEnabled: boolean;
  reminderEnabled: boolean;
  permissionGranted: boolean;
  dailyStylistTime: string;
  hasCorrectSchedule: boolean;
  hasScheduledNotification: boolean;
}): DailyStylistReminderReconcileAction {
  const shouldBeScheduled =
    dailyStylistEnabled &&
    reminderEnabled &&
    permissionGranted &&
    parseDailyStylistTime(dailyStylistTime) !== null;

  if (!shouldBeScheduled) {
    return hasScheduledNotification ? 'cancel' : 'none';
  }

  if (hasCorrectSchedule) {
    return 'none';
  }

  return 'schedule';
}

export function shouldClearReminderStateOnAccountCleanup(): boolean {
  return true;
}

export type DailyStylistReminderStateShape = {
  dailyStylistReminderEnabled: boolean;
  scheduledNotificationId: string | null;
};

export function buildReminderStateWhenDailyStylistDisabled(
  currentState: DailyStylistReminderStateShape,
): { nextState: DailyStylistReminderStateShape; shouldPersist: boolean } {
  const nextState: DailyStylistReminderStateShape = {
    dailyStylistReminderEnabled: false,
    scheduledNotificationId: null,
  };

  const shouldPersist =
    currentState.dailyStylistReminderEnabled || currentState.scheduledNotificationId !== null;

  return { nextState, shouldPersist };
}
