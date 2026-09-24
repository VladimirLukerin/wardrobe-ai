import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';

import { isDailyStylistNotificationResponse } from '@/services/daily-stylist-reminder';

function navigateToHomeFromDailyStylistNotification(): void {
  router.replace('/');
}

function handleDailyStylistNotificationResponse(
  response: Notifications.NotificationResponse | null,
): void {
  if (!isDailyStylistNotificationResponse(response)) {
    return;
  }

  navigateToHomeFromDailyStylistNotification();
  Notifications.clearLastNotificationResponse();
}

export function useDailyStylistNotificationNavigation(): void {
  const handledResponseKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    const handleResponse = (response: Notifications.NotificationResponse) => {
      const responseKey = `${response.notification.request.identifier}:${response.actionIdentifier}`;

      if (handledResponseKeyRef.current === responseKey) {
        return;
      }

      handledResponseKeyRef.current = responseKey;
      handleDailyStylistNotificationResponse(response);
    };

    const lastResponse = Notifications.getLastNotificationResponse();

    if (lastResponse) {
      handleResponse(lastResponse);
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);

    return () => {
      subscription.remove();
    };
  }, []);
}
