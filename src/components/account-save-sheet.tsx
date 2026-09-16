import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EmailLinkSheet from '@/components/email-link-sheet';
import PhoneLinkSheet from '@/components/phone-link-sheet';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

type AccountSaveSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export default function AccountSaveSheet({ visible, onClose }: AccountSaveSheetProps) {
  const insets = useSafeAreaInsets();
  const [isEmailLinkVisible, setIsEmailLinkVisible] = useState(false);
  const [isPhoneLinkVisible, setIsPhoneLinkVisible] = useState(false);

  const bottomInset = Math.max(insets.bottom, Spacing.three);
  const showChoice = visible && !isEmailLinkVisible && !isPhoneLinkVisible;

  return (
    <>
      <Modal visible={showChoice} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: bottomInset }]}>
            <View style={styles.header}>
              <ThemedText style={styles.title}>Сохраните свой аккаунт</ThemedText>
              <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedText style={styles.closeButton}>×</ThemedText>
              </Pressable>
            </View>

            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Подключите способ входа, чтобы восстановить гардероб на другом устройстве.
            </ThemedText>

            <Pressable
              onPress={() => setIsEmailLinkVisible(true)}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <ThemedText style={styles.primaryButtonText}>Подключить email</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setIsPhoneLinkVisible(true)}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <ThemedText style={styles.secondaryButtonText}>Подключить телефон</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <EmailLinkSheet visible={isEmailLinkVisible} onClose={() => setIsEmailLinkVisible(false)} />
      <PhoneLinkSheet visible={isPhoneLinkVisible} onClose={() => setIsPhoneLinkVisible(false)} />
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
