import { useDailyStylistReminderLifecycle } from '@/hooks/use-daily-stylist-reminder-lifecycle';

type DailyStylistReminderLifecycleProps = {
  enabled: boolean;
};

export function DailyStylistReminderLifecycle({ enabled }: DailyStylistReminderLifecycleProps) {
  useDailyStylistReminderLifecycle({ enabled });
  return null;
}
