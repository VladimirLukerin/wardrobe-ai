import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import {
  DEFAULT_DAILY_STYLIST_REMINDER_STATE,
  loadDailyStylistReminderState,
  saveDailyStylistReminderState,
  type DailyStylistReminderState,
} from '@/storage/daily-stylist-reminder-storage';
import type { StylistPreferences } from '@/constants/stylist-preferences';
import {
  isDailyStylistScheduleCorrect,
  parseDailyStylistTime,
  resolveDailyStylistReminderAction,
} from '@/utils/daily-stylist-reminder-plan';

export const DAILY_STYLIST_NOTIFICATION_TYPE = 'daily-stylist';
export const DAILY_STYLIST_NOTIFICATION_URL = '/';
export const DAILY_STYLIST_REMINDER_NOTIFICATION_ID = 'wardrobe-ai.daily-stylist-reminder';
export const DAILY_STYLIST_ANDROID_CHANNEL_ID = 'daily-stylist';

export type DailyStylistNotificationData = {
  type: typeof DAILY_STYLIST_NOTIFICATION_TYPE;
  url: typeof DAILY_STYLIST_NOTIFICATION_URL;
};

export type DailyStylistReminderPermissionStatus = 'granted' | 'denied' | 'undetermined';

export type DailyStylistReminderPermissionResult = {
  status: DailyStylistReminderPermissionStatus;
};

export type DailyStylistReminderScheduleResult =
  | { ok: true; notificationId: string }
  | { ok: false; reason: 'permission-denied' | 'invalid-time' | 'schedule-failed' };

export type DailyStylistReminderReconcileResult = {
  state: DailyStylistReminderState;
  action: 'none' | 'cancel' | 'schedule';
};

let androidChannelReady = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function isDailyStylistNotificationData(data: unknown): data is DailyStylistNotificationData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const payload = data as Partial<DailyStylistNotificationData>;

  return payload.type === DAILY_STYLIST_NOTIFICATION_TYPE && payload.url === DAILY_STYLIST_NOTIFICATION_URL;
}

export function isDailyStylistNotificationResponse(
  response: Notifications.NotificationResponse | null | undefined,
): boolean {
  if (!response) {
    return false;
  }

  return isDailyStylistNotificationData(response.notification.request.content.data);
}

export async function ensureDailyStylistAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android' || androidChannelReady) {
    return;
  }

  await Notifications.setNotificationChannelAsync(DAILY_STYLIST_ANDROID_CHANNEL_ID, {
    name: 'Daily Stylist',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });

  androidChannelReady = true;
}

export async function getDailyStylistReminderPermissionStatus(): Promise<DailyStylistReminderPermissionStatus> {
  const permissions = await Notifications.getPermissionsAsync();

  if (permissions.granted) {
    return 'granted';
  }

  if (permissions.status === Notifications.PermissionStatus.UNDETERMINED) {
    return 'undetermined';
  }

  return 'denied';
}

export async function requestDailyStylistReminderPermission(): Promise<DailyStylistReminderPermissionResult> {
  const currentStatus = await getDailyStylistReminderPermissionStatus();

  if (currentStatus === 'granted') {
    return { status: 'granted' };
  }

  if (currentStatus === 'denied') {
    return { status: 'denied' };
  }

  const permissions = await Notifications.requestPermissionsAsync();

  return {
    status: permissions.granted ? 'granted' : 'denied',
  };
}

async function findScheduledDailyStylistReminder(): Promise<Notifications.NotificationRequest | null> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  return (
    scheduled.find(
      (request) =>
        request.identifier === DAILY_STYLIST_REMINDER_NOTIFICATION_ID ||
        isDailyStylistNotificationData(request.content.data),
    ) ?? null
  );
}

async function cancelDailyStylistReminderById(notificationId: string | null): Promise<void> {
  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  await Notifications.cancelScheduledNotificationAsync(DAILY_STYLIST_REMINDER_NOTIFICATION_ID);
}

export async function cancelDailyStylistReminderSchedule(
  state?: DailyStylistReminderState,
): Promise<DailyStylistReminderState> {
  const currentState = state ?? (await loadDailyStylistReminderState());

  await cancelDailyStylistReminderById(currentState.scheduledNotificationId);

  const nextState: DailyStylistReminderState = {
    ...currentState,
    scheduledNotificationId: null,
  };

  await saveDailyStylistReminderState(nextState);

  return nextState;
}

export async function scheduleDailyStylistReminder(
  dailyStylistTime: string,
): Promise<DailyStylistReminderScheduleResult> {
  const permissionStatus = await getDailyStylistReminderPermissionStatus();

  if (permissionStatus !== 'granted') {
    return { ok: false, reason: 'permission-denied' };
  }

  const parsedTime = parseDailyStylistTime(dailyStylistTime);

  if (!parsedTime) {
    return { ok: false, reason: 'invalid-time' };
  }

  try {
    await ensureDailyStylistAndroidChannel();
    await cancelDailyStylistReminderById(DAILY_STYLIST_REMINDER_NOTIFICATION_ID);

    const notificationId = await Notifications.scheduleNotificationAsync({
      identifier: DAILY_STYLIST_REMINDER_NOTIFICATION_ID,
      content: {
        title: 'Образ на сегодня',
        body: 'Пора выбрать, что надеть сегодня.',
        sound: 'default',
        data: {
          type: DAILY_STYLIST_NOTIFICATION_TYPE,
          url: DAILY_STYLIST_NOTIFICATION_URL,
        } satisfies DailyStylistNotificationData,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: parsedTime.hour,
        minute: parsedTime.minute,
        ...(Platform.OS === 'android'
          ? { channelId: DAILY_STYLIST_ANDROID_CHANNEL_ID }
          : {}),
      },
    });

    return { ok: true, notificationId };
  } catch (error) {
    if (__DEV__) {
      console.error('[DAILY REMINDER] schedule failed', error);
    }

    return { ok: false, reason: 'schedule-failed' };
  }
}

export async function reconcileDailyStylistReminder({
  stylistPreferences,
  reminderState,
}: {
  stylistPreferences: Pick<
    StylistPreferences,
    'dailyStylistEnabled' | 'dailyStylistTime' | 'timezone'
  >;
  reminderState?: DailyStylistReminderState;
}): Promise<DailyStylistReminderReconcileResult> {
  const currentState = reminderState ?? (await loadDailyStylistReminderState());
  const permissionGranted = (await getDailyStylistReminderPermissionStatus()) === 'granted';
  const scheduled = await findScheduledDailyStylistReminder();
  const parsedTime = parseDailyStylistTime(stylistPreferences.dailyStylistTime);
  const hasCorrectSchedule =
    scheduled !== null &&
    parsedTime !== null &&
    isDailyStylistScheduleCorrect(scheduled.trigger, parsedTime);

  const action = resolveDailyStylistReminderAction({
    dailyStylistEnabled: stylistPreferences.dailyStylistEnabled,
    reminderEnabled: currentState.dailyStylistReminderEnabled,
    permissionGranted,
    dailyStylistTime: stylistPreferences.dailyStylistTime,
    hasCorrectSchedule,
    hasScheduledNotification: scheduled !== null,
  });

  if (action === 'none') {
    const syncedState =
      scheduled && currentState.scheduledNotificationId !== scheduled.identifier
        ? {
            ...currentState,
            scheduledNotificationId: scheduled.identifier,
          }
        : currentState;

    if (syncedState !== currentState) {
      await saveDailyStylistReminderState(syncedState);
    }

    return { state: syncedState, action: 'none' };
  }

  if (action === 'cancel') {
    const nextState = await cancelDailyStylistReminderSchedule(currentState);
    return { state: nextState, action: 'cancel' };
  }

  const scheduleResult = await scheduleDailyStylistReminder(stylistPreferences.dailyStylistTime);

  if (!scheduleResult.ok) {
    const nextState = await cancelDailyStylistReminderSchedule({
      ...currentState,
      dailyStylistReminderEnabled: false,
    });

    return { state: nextState, action: 'cancel' };
  }

  const nextState: DailyStylistReminderState = {
    ...currentState,
    scheduledNotificationId: scheduleResult.notificationId,
  };

  await saveDailyStylistReminderState(nextState);

  return { state: nextState, action: 'schedule' };
}

export async function saveDailyStylistReminderEnabled(
  enabled: boolean,
): Promise<DailyStylistReminderState> {
  const currentState = await loadDailyStylistReminderState();
  const nextState: DailyStylistReminderState = {
    ...currentState,
    dailyStylistReminderEnabled: enabled,
    scheduledNotificationId: enabled ? currentState.scheduledNotificationId : null,
  };

  await saveDailyStylistReminderState(nextState);

  if (!enabled) {
    return cancelDailyStylistReminderSchedule(nextState);
  }

  return nextState;
}

export async function clearDailyStylistReminderForAccountSwitch(): Promise<void> {
  const currentState = await loadDailyStylistReminderState();

  await cancelDailyStylistReminderById(currentState.scheduledNotificationId);
  await saveDailyStylistReminderState(DEFAULT_DAILY_STYLIST_REMINDER_STATE);
}

export async function scheduleDailyStylistDevTestNotification(): Promise<
  DailyStylistReminderScheduleResult | { ok: false; reason: 'permission-denied' }
> {
  const permissionStatus = await getDailyStylistReminderPermissionStatus();

  if (permissionStatus !== 'granted') {
    return { ok: false, reason: 'permission-denied' };
  }

  try {
    await ensureDailyStylistAndroidChannel();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Образ на сегодня',
        body: 'Пора выбрать, что надеть сегодня.',
        sound: 'default',
        data: {
          type: DAILY_STYLIST_NOTIFICATION_TYPE,
          url: DAILY_STYLIST_NOTIFICATION_URL,
        } satisfies DailyStylistNotificationData,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
      },
    });

    return { ok: true, notificationId: 'dev-test-notification' };
  } catch (error) {
    if (__DEV__) {
      console.error('[DAILY REMINDER] dev test schedule failed', error);
    }

    return { ok: false, reason: 'schedule-failed' };
  }
}
