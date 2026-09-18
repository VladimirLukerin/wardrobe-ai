import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import {
  OUTFIT_FEEDBACK_REASON_LABELS,
  OUTFIT_FEEDBACK_REASONS,
  type OutfitFeedbackReason,
} from '@/constants/outfit-feedback';
import { Colors, Spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSelectReason: (reason: OutfitFeedbackReason | null) => void;
};

export function OutfitFeedbackDislikeSheet({
  visible,
  isSubmitting,
  onClose,
  onSelectReason,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={isSubmitting ? undefined : onClose}
          accessibilityLabel="Закрыть"
          accessibilityRole="button"
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Что не подошло?</ThemedText>
            <Pressable
              onPress={onClose}
              disabled={isSubmitting}
              accessibilityLabel="Закрыть"
              accessibilityRole="button"
              style={styles.close}>
              <ThemedText style={styles.title}>×</ThemedText>
            </Pressable>
          </View>
          <ThemedText themeColor="textSecondary" style={styles.hint}>
            Можно выбрать причину или просто закрыть — мы всё равно учтём вашу оценку.
          </ThemedText>
          <View style={styles.options}>
            {OUTFIT_FEEDBACK_REASONS.map((reason) => (
              <Pressable
                key={reason}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel={OUTFIT_FEEDBACK_REASON_LABELS[reason]}
                onPress={() => onSelectReason(reason)}
                style={({ pressed }) => [
                  styles.option,
                  pressed && !isSubmitting && styles.pressed,
                  isSubmitting && styles.disabled,
                ]}>
                <ThemedText style={styles.optionText}>{OUTFIT_FEEDBACK_REASON_LABELS[reason]}</ThemedText>
              </Pressable>
            ))}
            <Pressable
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Сохранить без причины"
              onPress={() => onSelectReason(null)}
              style={({ pressed }) => [
                styles.option,
                styles.skipOption,
                pressed && !isSubmitting && styles.pressed,
                isSubmitting && styles.disabled,
              ]}>
              <ThemedText themeColor="textSecondary" style={styles.optionText}>
                Сохранить без причины
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 21,
    fontWeight: '600',
  },
  close: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    marginTop: 6,
    marginBottom: Spacing.two,
    fontSize: 14,
    lineHeight: 20,
  },
  options: {
    gap: Spacing.one,
  },
  option: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundElement,
  },
  skipOption: {
    marginTop: Spacing.half,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
