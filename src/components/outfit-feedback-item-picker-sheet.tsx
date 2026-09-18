import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { getWardrobeItemDisplayImageUri } from '@/constants/wardrobe-item';
import type { WardrobeItem } from '@/contexts/wardrobe-context';

type Props = {
  visible: boolean;
  items: WardrobeItem[];
  isSubmitting: boolean;
  onClose: () => void;
  onSelectItem: (itemId: string) => void;
};

export function OutfitFeedbackItemPickerSheet({
  visible,
  items,
  isSubmitting,
  onClose,
  onSelectItem,
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
            <ThemedText style={styles.title}>Какую вещь не хотите?</ThemedText>
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
            Выберите одну вещь из текущего образа.
          </ThemedText>
          <View style={styles.options}>
            {items.map((item) => (
              <Pressable
                key={item.id}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel={item.name}
                onPress={() => onSelectItem(item.id)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && !isSubmitting && styles.pressed,
                  isSubmitting && styles.disabled,
                ]}>
                <Image
                  source={{ uri: getWardrobeItemDisplayImageUri(item) }}
                  style={styles.image}
                  contentFit="contain"
                />
                <View style={styles.textWrap}>
                  <ThemedText style={styles.name}>{item.name}</ThemedText>
                  <ThemedText themeColor="textSecondary">
                    {item.category} · {item.color}
                  </ThemedText>
                </View>
              </Pressable>
            ))}
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
    maxHeight: '78%',
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
    flex: 1,
    paddingRight: Spacing.one,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundElement,
  },
  image: {
    width: 72,
    height: 80,
  },
  textWrap: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
