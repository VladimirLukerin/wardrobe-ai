import { DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { HomeLaunchOverlay } from '@/components/home-launch-overlay';
import { HomeDailyContentProvider } from '@/contexts/home-daily-content-context';
import AppTabs from '@/components/app-tabs';
import { AccountProfileProvider } from '@/contexts/account-profile-context';
import { BodyParametersProvider } from '@/contexts/body-parameters-context';
import { FamilyProvider } from '@/contexts/family-context';
import { StylistPreferencesProvider } from '@/contexts/stylist-preferences-context';
import { StylePreferencesProvider } from '@/contexts/style-preferences-context';
import { OutfitsProvider } from '@/contexts/outfits-context';
import { WearHistoryProvider } from '@/contexts/wear-history-context';
import { WardrobeProvider } from '@/contexts/wardrobe-context';

void SplashScreen.preventAutoHideAsync().catch(() => {});
let launchPlayed = false;

export default function TabLayout() {
  const [showLaunch, setShowLaunch] = useState(!launchPlayed);
  const finishLaunch = useCallback(() => { launchPlayed = true; setShowLaunch(false); }, []);
  return (
    <WardrobeProvider>
      <OutfitsProvider>
        <WearHistoryProvider>
          <AccountProfileProvider>
            <StylePreferencesProvider>
              <StylistPreferencesProvider>
                <BodyParametersProvider>
                  <FamilyProvider>
                    <ThemeProvider value={DefaultTheme}>
                      <HomeDailyContentProvider>
                        <View style={{ flex: 1 }}>
                          <AppTabs />
                          {showLaunch && <HomeLaunchOverlay onComplete={finishLaunch} />}
                        </View>
                      </HomeDailyContentProvider>
                    </ThemeProvider>
                  </FamilyProvider>
                </BodyParametersProvider>
              </StylistPreferencesProvider>
            </StylePreferencesProvider>
          </AccountProfileProvider>
        </WearHistoryProvider>
      </OutfitsProvider>
    </WardrobeProvider>
  );
}
