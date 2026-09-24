import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

type WearWithChoiceSheetProps = {
  visible: boolean;
  onClose: () => void;
  onChoosePersonal: () => void;
  onChoosePaired: () => void;
  pairedOnly?: boolean;
};

export function WearWithChoiceSheet({
  visible,
  onClose,
  onChoosePersonal,
  onChoosePaired,
  pairedOnly = false,
}: WearWithChoiceSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <ThemedText style={styles.title}>С чем носить</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            {pairedOnly
              ? 'Подберём совместный образ с членом семьи вокруг выбранной вещи.'
              : 'Выберите, для кого подбираем сочетания.'}
          </ThemedText>

          {!pairedOnly ? (
            <Pressable
              onPress={() => {
                onClose();
                onChoosePersonal();
              }}
              style={({ pressed }) => [styles.optionButton, pressed && styles.pressed]}>
              <ThemedText style={styles.optionTitle}>Для себя</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.optionDescription}>
                Персональные образы вокруг этой вещи
              </ThemedText>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => {
              onClose();
              onChoosePaired();
            }}
            style={({ pressed }) => [styles.optionButton, pressed && styles.pressed]}>
            <ThemedText style={styles.optionTitle}>Вместе с семьёй</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.optionDescription}>
              Совместный образ с выбранной вещью
            </ThemedText>
          </Pressable>

          <Pressable onPress={onClose} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
            <ThemedText style={styles.cancelButtonText}>Отмена</ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
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
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  optionButton: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.backgroundSelected,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.half,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  pressed: {
    opacity: 0.85,
  },
});
