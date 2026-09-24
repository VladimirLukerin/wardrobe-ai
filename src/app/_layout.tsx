import * as SplashScreen from 'expo-splash-screen';

import { AccountScopedApp } from '@/components/account-scoped-app';
import { AccountProvider } from '@/contexts/account-context';
import { AccountProfileProvider } from '@/contexts/account-profile-context';
import { AppConfigProvider } from '@/contexts/app-config-context';
import { useDailyStylistNotificationNavigation } from '@/hooks/use-daily-stylist-notification-navigation';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function TabLayout() {
  useDailyStylistNotificationNavigation();

  return (
    <AppConfigProvider>
      <AccountProfileProvider>
        <AccountProvider>
          <AccountScopedApp />
        </AccountProvider>
      </AccountProfileProvider>
    </AppConfigProvider>
  );
}
