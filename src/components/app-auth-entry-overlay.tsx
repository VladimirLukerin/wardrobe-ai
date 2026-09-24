import { Image } from 'expo-image';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/primary-button';
import { TextAction } from '@/components/ui/text-action';
import { PrikinLogo } from '@/components/welcome/prikin-logo';
import { PrikinTagline } from '@/components/welcome/prikin-tagline';
import {
  PrikinColors,
  PrikinSpacing,
  PrikinTypography,
} from '@/constants/prikin-tokens';

const welcomeBackground = require('@/assets/welcome/paper_city_background.png');

type AppAuthEntryOverlayProps = {
  visible: boolean;
  variant: 'firstLaunch' | 'returning';
  isLoading?: boolean;
  errorMessage?: string | null;
  onStartGuest: () => void;
  onLogin: () => void;
};

export function AppAuthEntryOverlay({
  visible,
  variant: _variant,
  isLoading = false,
  errorMessage = null,
  onStartGuest,
  onLogin,
}: AppAuthEntryOverlayProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const horizontalInset = PrikinSpacing.welcomeHorizontal;
  const logoWidth = Math.min(windowWidth - horizontalInset * 2, 318);
  const taglineWidth = Math.min(windowWidth - horizontalInset * 2 + 12, 336);

  if (!visible) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, styles.overlayRoot]}
      accessibilityViewIsModal>
      <Image
        source={welcomeBackground}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="center"
        accessibilityIgnoresInvertColors
      />

      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + PrikinSpacing.welcomeHeroGap,
            paddingBottom: insets.bottom + PrikinSpacing.welcomeBottomExtra,
            paddingHorizontal: horizontalInset,
          },
        ]}>
        <View style={styles.hero}>
          <PrikinLogo width={logoWidth} />
          <View style={styles.taglineWrap}>
            <PrikinTagline width={taglineWidth} />
          </View>
        </View>

        <View style={styles.actions}>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <PrimaryButton
            label="Продолжить без входа"
            onPress={onStartGuest}
            disabled={isLoading}
            loading={isLoading}
          />

          <TextAction label="Уже есть аккаунт? Войти" onPress={onLogin} disabled={isLoading} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: PrikinColors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: PrikinSpacing.welcomeHeroGap,
  },
  taglineWrap: {
    marginTop: PrikinSpacing.welcomeTaglineTop,
    alignItems: 'center',
  },
  actions: {
    gap: PrikinSpacing.welcomeActionsGap,
  },
  errorText: {
    ...PrikinTypography.error,
    textAlign: 'center',
  },
});
