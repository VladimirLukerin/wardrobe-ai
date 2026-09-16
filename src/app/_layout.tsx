import * as SplashScreen from 'expo-splash-screen';

import { AccountScopedApp } from '@/components/account-scoped-app';
import { AccountProvider } from '@/contexts/account-context';
import { AccountProfileProvider } from '@/contexts/account-profile-context';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function TabLayout() {
  return (
    <AccountProfileProvider>
      <AccountProvider>
        <AccountScopedApp />
      </AccountProvider>
    </AccountProfileProvider>
  );
}
