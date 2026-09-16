import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import AccountLoginChoiceSheet from '@/components/account-login-choice-sheet';
import { AccountProfileReloader } from '@/components/account-profile-reloader';
import { AccountRestoreOverlay } from '@/components/account-restore-overlay';
import { AppAuthEntryOverlay } from '@/components/app-auth-entry-overlay';
import AppTabs from '@/components/app-tabs';
import { FamilyInviteBanner } from '@/components/family-invite-banner';
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
import { useCameraPermissionStartup } from '@/hooks/use-camera-permission-startup';
import { isOnboardingCompleted, markOnboardingCompleted } from '@/storage/onboarding-storage';
import { DefaultTheme, ThemeProvider } from 'expo-router';

let launchPlayed = false;

export function AccountScopedApp() {
  const {
    accountSessionKey,
    isHydrated,
    isSyncing,
    isRestoringAccount,
    needsAuthEntry,
    error,
    startGuestSession,
  } = useAccount();
  const [showLaunch, setShowLaunch] = useState(!launchPlayed);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isLoginChoiceVisible, setIsLoginChoiceVisible] = useState(false);

  const finishLaunch = useCallback(() => {
    launchPlayed = true;
    setShowLaunch(false);
  }, []);

  const refreshOnboardingState = useCallback(() => {
    void isOnboardingCompleted().then((completed) => {
      setHasCompletedOnboarding(completed);
      setOnboardingChecked(true);
    });
  }, []);

  useEffect(() => {
    if (__DEV__) {
      console.log(`[ACCOUNT REMOUNT] ${accountSessionKey}`);
    }

    setIsLoginChoiceVisible(false);
    refreshOnboardingState();
  }, [accountSessionKey, refreshOnboardingState]);

  const handleStartGuest = useCallback(async () => {
    if (__DEV__) {
      console.log('[AUTH ENTRY] guest pressed');
      console.log('[AUTH ENTRY] guest session start');
    }

    await markOnboardingCompleted();
    setHasCompletedOnboarding(true);

    const guestStarted = await startGuestSession();

    if (__DEV__ && guestStarted) {
      console.log('[AUTH ENTRY] guest session success');
    }

    if (__DEV__ && !guestStarted) {
      console.log('[AUTH ENTRY] guest session failed');
    }
  }, [startGuestSession]);

  const handleOpenLogin = useCallback(() => {
    if (__DEV__) {
      console.log('[AUTH ENTRY] login pressed');
      console.log('[AUTH ENTRY] login sheet open');
    }

    setIsLoginChoiceVisible(true);
  }, []);

  const handleLoginSuccess = useCallback(async () => {
    await markOnboardingCompleted();
    setHasCompletedOnboarding(true);
    setIsLoginChoiceVisible(false);
  }, []);

  const showAuthEntry = isHydrated && onboardingChecked && needsAuthEntry;
  const showAuthEntryOverlay = showAuthEntry && !isLoginChoiceVisible;
  const showMainApp = isHydrated && !needsAuthEntry;
  const authEntryVariant = hasCompletedOnboarding ? 'returning' : 'firstLaunch';

  useCameraPermissionStartup(showMainApp);

  return (
    <>
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
                                  {showMainApp ? <AppTabs /> : null}
                                  {showMainApp && showLaunch && !isRestoringAccount ? (
                                    <HomeLaunchOverlay onComplete={finishLaunch} />
                                  ) : null}
                                  {showMainApp ? <AccountRestoreOverlay /> : null}
                                  {showMainApp && !showLaunch && !isRestoringAccount ? (
                                    <FamilyInviteBanner />
                                  ) : null}
                                  <AccountLoginChoiceSheet
                                    visible={isLoginChoiceVisible}
                                    onClose={() => setIsLoginChoiceVisible(false)}
                                    onSuccess={handleLoginSuccess}
                                  />
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

      <AppAuthEntryOverlay
        visible={showAuthEntryOverlay}
        variant={authEntryVariant}
        isLoading={isSyncing}
        errorMessage={error}
        onStartGuest={() => {
          void handleStartGuest();
        }}
        onLogin={handleOpenLogin}
      />
    </>
  );
}
