import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

type PhotoRetakeSheetProps = {
  visible: boolean;
  title?: string;
  message?: string | null;
  hint?: string | null;
  primaryLabel?: string;
  secondaryLabel?: string;
  onClose: () => void;
  onRetakePhoto: () => void;
  onPickAnotherPhoto: () => void;
};

const DEFAULT_TITLE = 'Переснимите вещь';
const DEFAULT_HINT =
  'Для быстрого и точного распознавания:\n• снимите только одну вещь;\n• положите или повесьте её отдельно;\n• убедитесь, что вещь полностью видна.';
const DEFAULT_PRIMARY_LABEL = 'Переснять';
const DEFAULT_SECONDARY_LABEL = 'Выбрать другое фото';

export default function PhotoRetakeSheet({
  visible,
  title = DEFAULT_TITLE,
  message = null,
  hint = DEFAULT_HINT,
  primaryLabel = DEFAULT_PRIMARY_LABEL,
  secondaryLabel = DEFAULT_SECONDARY_LABEL,
  onClose,
  onRetakePhoto,
  onPickAnotherPhoto,
}: PhotoRetakeSheetProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Spacing.three);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: bottomInset }]}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>{title}</ThemedText>
            <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [pressed && styles.pressed]}>
              <ThemedText style={styles.closeButton}>×</ThemedText>
            </Pressable>
          </View>

          {message ? <ThemedText style={styles.message}>{message}</ThemedText> : null}

          {hint ? (
            <ThemedText themeColor="textSecondary" style={styles.body}>
              {hint}
            </ThemedText>
          ) : null}

          <Pressable
            onPress={onRetakePhoto}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <ThemedText style={styles.primaryButtonText}>{primaryLabel}</ThemedText>
          </Pressable>

          <Pressable
            onPress={onPickAnotherPhoto}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <ThemedText style={styles.secondaryButtonText}>{secondaryLabel}</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
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
    flex: 1,
    paddingRight: Spacing.two,
  },
  closeButton: {
    fontSize: 28,
    lineHeight: 28,
    color: Colors.light.textSecondary,
  },
  message: {
    fontSize: 16,
    lineHeight: 22,
    color: Colors.light.text,
  },
  body: {
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
