import AsyncStorage from '@react-native-async-storage/async-storage';

export const DAILY_STYLIST_REMINDER_STORAGE_KEY = '@wardrobe-ai/profile/daily-stylist-reminder';

export type DailyStylistReminderState = {
  dailyStylistReminderEnabled: boolean;
  scheduledNotificationId: string | null;
};

export const DEFAULT_DAILY_STYLIST_REMINDER_STATE: DailyStylistReminderState = {
  dailyStylistReminderEnabled: false,
  scheduledNotificationId: null,
};

function parseDailyStylistReminderState(raw: unknown): DailyStylistReminderState | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const data = raw as Partial<DailyStylistReminderState>;

  return {
    dailyStylistReminderEnabled:
      typeof data.dailyStylistReminderEnabled === 'boolean'
        ? data.dailyStylistReminderEnabled
        : DEFAULT_DAILY_STYLIST_REMINDER_STATE.dailyStylistReminderEnabled,
    scheduledNotificationId:
      typeof data.scheduledNotificationId === 'string' && data.scheduledNotificationId.length > 0
        ? data.scheduledNotificationId
        : null,
  };
}

export async function loadDailyStylistReminderState(): Promise<DailyStylistReminderState> {
  try {
    const raw = await AsyncStorage.getItem(DAILY_STYLIST_REMINDER_STORAGE_KEY);

    if (!raw) {
      return DEFAULT_DAILY_STYLIST_REMINDER_STATE;
    }

    return parseDailyStylistReminderState(JSON.parse(raw)) ?? DEFAULT_DAILY_STYLIST_REMINDER_STATE;
  } catch {
    return DEFAULT_DAILY_STYLIST_REMINDER_STATE;
  }
}

export async function saveDailyStylistReminderState(
  state: DailyStylistReminderState,
): Promise<void> {
  try {
    await AsyncStorage.setItem(DAILY_STYLIST_REMINDER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Keep in-memory state even if persistence fails.
  }
}
