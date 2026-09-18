import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

type HomeAccountReminderCardProps = {
  onSaveAccount: () => void;
  onDismiss: () => void;
};

export function HomeAccountReminderCard({ onSaveAccount, onDismiss }: HomeAccountReminderCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.textBlock}>
        <ThemedText style={styles.title}>Не потеряйте гардероб</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          Подключите email или телефон, чтобы восстановить данные на другом устройстве.
        </ThemedText>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onSaveAccount}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <ThemedText style={styles.primaryButtonText}>Сохранить аккаунт</ThemedText>
        </Pressable>

        <Pressable onPress={onDismiss} hitSlop={8} style={({ pressed }) => [styles.dismissButton, pressed && styles.pressed]}>
          <ThemedText themeColor="textSecondary" style={styles.dismissText}>
            Скрыть
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundElement,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  textBlock: {
    gap: Spacing.one,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    gap: Spacing.two,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.text,
    paddingHorizontal: Spacing.three,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.background,
  },
  dismissButton: {
    alignSelf: 'center',
    paddingVertical: Spacing.one,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.85,
  },
});
