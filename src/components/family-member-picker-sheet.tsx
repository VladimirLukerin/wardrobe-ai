import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { getFamilyMemberLabel } from '@/constants/family';
import { Colors, Spacing } from '@/constants/theme';
import { useFamily } from '@/contexts/family-context';

type FamilyMemberPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (memberPublicId: string) => void;
};

export function FamilyMemberPickerSheet({
  visible,
  onClose,
  onSelect,
}: FamilyMemberPickerSheetProps) {
  const { members } = useFamily();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <ThemedText style={styles.title}>С кем создаём образ?</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Выберите члена семьи для совместного подбора.
          </ThemedText>

          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {members.map((member) => (
              <Pressable
                key={member.publicId}
                onPress={() => {
                  onClose();
                  onSelect(member.publicId);
                }}
                style={({ pressed }) => [styles.memberRow, pressed && styles.pressed]}>
                <ThemedText style={styles.memberLabel}>{getFamilyMemberLabel(member)}</ThemedText>
              </Pressable>
            ))}
          </ScrollView>

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
    maxHeight: '70%',
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
  list: {
    gap: Spacing.one,
  },
  memberRow: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.backgroundSelected,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  memberLabel: {
    fontSize: 16,
    fontWeight: '500',
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
