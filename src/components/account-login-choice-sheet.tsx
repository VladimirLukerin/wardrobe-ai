import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EmailLoginSheet from '@/components/email-login-sheet';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import type { ConfirmAccountSwitchFn } from '@/hooks/use-auth-account-switch';
import { useAuthEntryAccountSwitch } from '@/hooks/use-auth-account-switch';
import { useConfirmAccountSwitch } from '@/hooks/use-confirm-account-switch';

type AccountLoginChoiceSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onCreateAccount?: (email: string) => void | Promise<void>;
  confirmAndSwitch: ConfirmAccountSwitchFn;
  overlayStyle?: 'dimmed' | 'transparent';
};

function AccountLoginChoiceSheetBody({
  visible,
  onClose,
  onSuccess,
  onCreateAccount,
  confirmAndSwitch,
  overlayStyle = 'dimmed',
}: AccountLoginChoiceSheetProps) {
  const insets = useSafeAreaInsets();
  const [isEmailLoginVisible, setIsEmailLoginVisible] = useState(false);

  const bottomInset = Math.max(insets.bottom, Spacing.three);
  const showChoice = visible && !isEmailLoginVisible;

  const handleLoginSuccess = () => {
    setIsEmailLoginVisible(false);
    onClose();
    onSuccess?.();
  };

  const handlePhonePress = () => {
    Alert.alert('Вход по телефону появится позже');
  };

  return (
    <>
      <Modal visible={showChoice} transparent animationType="slide" onRequestClose={onClose}>
        <View style={[styles.overlay, overlayStyle === 'transparent' && styles.overlayTransparent]}>
          <View style={[styles.sheet, { paddingBottom: bottomInset }]}>
            <View style={styles.header}>
              <ThemedText style={styles.title}>Войти в Wardrobe AI</ThemedText>
              <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedText style={styles.closeButton}>×</ThemedText>
              </Pressable>
            </View>

            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Войдите, если уже пользовались приложением на другом устройстве.
            </ThemedText>

            <Pressable
              onPress={() => setIsEmailLoginVisible(true)}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <ThemedText style={styles.primaryButtonText}>Войти по email</ThemedText>
            </Pressable>

            <Pressable
              onPress={handlePhonePress}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <ThemedText style={styles.secondaryButtonText}>Войти по телефону</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <EmailLoginSheet
        visible={isEmailLoginVisible}
        confirmAndSwitch={confirmAndSwitch}
        overlayStyle={overlayStyle}
        onClose={() => setIsEmailLoginVisible(false)}
        onSuccess={handleLoginSuccess}
        onCreateAccount={onCreateAccount}
      />
    </>
  );
}

export default function AccountLoginChoiceSheet(
  props: Omit<AccountLoginChoiceSheetProps, 'confirmAndSwitch'>,
) {
  const { confirmAndSwitch } = useConfirmAccountSwitch();

  return <AccountLoginChoiceSheetBody {...props} confirmAndSwitch={confirmAndSwitch} />;
}

export function AuthEntryAccountLoginChoiceSheet(
  props: Omit<AccountLoginChoiceSheetProps, 'confirmAndSwitch' | 'overlayStyle'>,
) {
  const { confirmAndSwitch } = useAuthEntryAccountSwitch();

  return <AccountLoginChoiceSheetBody {...props} confirmAndSwitch={confirmAndSwitch} overlayStyle="transparent" />;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  overlayTransparent: {
    backgroundColor: 'transparent',
  },
  sheet: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  closeButton: {
    fontSize: 28,
    lineHeight: 28,
    color: Colors.light.textSecondary,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.text,
    paddingHorizontal: Spacing.three,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.background,
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.backgroundSelected,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  pressed: {
    opacity: 0.85,
  },
});
