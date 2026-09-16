import { useCallback, useState } from 'react';
import { View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { AccountProfileReloader } from '@/components/account-profile-reloader';
import { AccountRestoreOverlay } from '@/components/account-restore-overlay';
import { HomeLaunchOverlay } from '@/components/home-launch-overlay';
import { useAccount } from '@/contexts/account-context';
import { BodyParametersProvider } from '@/contexts/body-parameters-context';
import { FamilyProvider } from '@/contexts/family-context';
import { HomeDailyContentProvider } from '@/contexts/home-daily-content-context';
import { OutfitsProvider } from '@/contexts/outfits-context';
import { OutfitsSyncProvider } from '@/contexts/outfits-sync-context';
import { PreferencesSyncProvider } from '@/contexts/preferences-sync-context';
import { StylistPreferencesProvider } from '@/contexts/stylist-preferences-context';
import { StylePreferencesProvider } from '@/contexts/style-preferences-context';
import { WearHistoryProvider } from '@/contexts/wear-history-context';
import { WearHistorySyncProvider } from '@/contexts/wear-history-sync-context';
import { WardrobeSyncProvider } from '@/contexts/wardrobe-sync-context';
import { WardrobeProvider } from '@/contexts/wardrobe-context';
import { DefaultTheme, ThemeProvider } from 'expo-router';

let launchPlayed = false;

export function AccountScopedApp() {
  const { accountSessionKey } = useAccount();
  const [showLaunch, setShowLaunch] = useState(!launchPlayed);
  const finishLaunch = useCallback(() => {
    launchPlayed = true;
    setShowLaunch(false);
  }, []);

  return (
    <WardrobeProvider key={accountSessionKey}>
      <OutfitsProvider key={accountSessionKey}>
        <WearHistoryProvider key={accountSessionKey}>
          <AccountProfileReloader />
          <WardrobeSyncProvider key={accountSessionKey}>
            <OutfitsSyncProvider key={accountSessionKey}>
              <WearHistorySyncProvider key={accountSessionKey}>
                <StylePreferencesProvider key={accountSessionKey}>
                  <StylistPreferencesProvider key={accountSessionKey}>
                    <BodyParametersProvider key={accountSessionKey}>
                      <PreferencesSyncProvider key={accountSessionKey}>
                        <FamilyProvider>
                          <ThemeProvider value={DefaultTheme}>
                            <HomeDailyContentProvider key={accountSessionKey}>
                              <View style={{ flex: 1 }}>
                                <AppTabs />
                                {showLaunch && <HomeLaunchOverlay onComplete={finishLaunch} />}
                                <AccountRestoreOverlay />
                              </View>
                            </HomeDailyContentProvider>
                          </ThemeProvider>
                        </FamilyProvider>
                      </PreferencesSyncProvider>
                    </BodyParametersProvider>
                  </StylistPreferencesProvider>
                </StylePreferencesProvider>
              </WearHistorySyncProvider>
            </OutfitsSyncProvider>
          </WardrobeSyncProvider>
        </WearHistoryProvider>
      </OutfitsProvider>
    </WardrobeProvider>
  );
}
