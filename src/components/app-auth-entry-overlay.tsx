import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { APP_BRAND_NAME } from '@/constants/app-brand';
import { Colors, Spacing } from '@/constants/theme';

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
  variant,
  isLoading = false,
  errorMessage = null,
  onStartGuest,
  onLogin,
}: AppAuthEntryOverlayProps) {
  const insets = useSafeAreaInsets();
  const isFirstLaunch = variant === 'firstLaunch';
  const primaryLabel = isFirstLaunch ? 'Начать без входа' : 'Продолжить без входа';

  if (!visible) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, styles.overlayRoot]}
      accessibilityViewIsModal>
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + Spacing.four },
        ]}>
        <View style={styles.content}>
          {isFirstLaunch ? (
            <>
              <ThemedText style={styles.brand}>{APP_BRAND_NAME}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                Соберите свой гардероб, а AI поможет выбирать образы под погоду и ваш стиль.
              </ThemedText>
            </>
          ) : (
            <>
              <ThemedText style={styles.title}>Добро пожаловать</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                Войдите в существующий аккаунт или продолжите без входа.
              </ThemedText>
            </>
          )}
        </View>

        <View style={styles.actions}>
          {errorMessage ? (
            <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
          ) : null}

          <Pressable
            onPress={onStartGuest}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.primaryButton,
              isLoading && styles.primaryButtonDisabled,
              pressed && styles.pressed,
            ]}>
            {isLoading ? (
              <ActivityIndicator color={Colors.light.background} />
            ) : (
              <ThemedText style={styles.primaryButtonText}>{primaryLabel}</ThemedText>
            )}
          </Pressable>

          <Pressable
            onPress={onLogin}
            disabled={isLoading}
            hitSlop={8}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <ThemedText style={styles.secondaryButtonText}>Уже есть аккаунт? Войти</ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: Colors.light.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.two,
  },
  brand: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
    color: Colors.light.text,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
  },
  actions: {
    gap: Spacing.three,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: '#DC2626',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.text,
    paddingHorizontal: Spacing.three,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.background,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  pressed: {
    opacity: 0.85,
  },
});
