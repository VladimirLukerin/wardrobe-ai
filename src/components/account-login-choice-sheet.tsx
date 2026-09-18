import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EmailLoginSheet from '@/components/email-login-sheet';
import PhoneLoginSheet from '@/components/phone-login-sheet';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

type AccountLoginChoiceSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function AccountLoginChoiceSheet({
  visible,
  onClose,
  onSuccess,
}: AccountLoginChoiceSheetProps) {
  const insets = useSafeAreaInsets();
  const [isEmailLoginVisible, setIsEmailLoginVisible] = useState(false);
  const [isPhoneLoginVisible, setIsPhoneLoginVisible] = useState(false);

  const bottomInset = Math.max(insets.bottom, Spacing.three);
  const showChoice = visible && !isEmailLoginVisible && !isPhoneLoginVisible;

  const handleLoginSuccess = () => {
    setIsEmailLoginVisible(false);
    setIsPhoneLoginVisible(false);
    onClose();
    onSuccess?.();
  };

  return (
    <>
      <Modal visible={showChoice} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.overlay}>
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
              onPress={() => setIsPhoneLoginVisible(true)}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <ThemedText style={styles.secondaryButtonText}>Войти по телефону</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <EmailLoginSheet
        visible={isEmailLoginVisible}
        onClose={() => setIsEmailLoginVisible(false)}
        onSuccess={handleLoginSuccess}
      />
      <PhoneLoginSheet
        visible={isPhoneLoginVisible}
        onClose={() => setIsPhoneLoginVisible(false)}
        onSuccess={handleLoginSuccess}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
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
