import { Image } from 'expo-image';
import { Modal, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { getWardrobeItemDisplayImageUri } from '@/constants/wardrobe-item';
import type { WardrobeItem } from '@/contexts/wardrobe-context';
import { getReplacementCandidates } from '@/utils/outfit-item-replacement';

type Props = {
  updateExisting?: boolean;
  targetId: string | null;
  itemIds: string[];
  wardrobe: WardrobeItem[];
  onClose: () => void;
  onSelect: (targetId: string, replacementId: string) => void;
};
export function OutfitReplacementSheet({ targetId, itemIds, wardrobe, onClose, onSelect, updateExisting }: Props) {
  const insets = useSafeAreaInsets();
  const target = wardrobe.find((item) => item.id === targetId);
  const candidates = targetId ? getReplacementCandidates(wardrobe, itemIds, targetId) : [];
  return (
    <Modal visible={!!targetId} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Закрыть выбор" accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Заменить вещь</ThemedText>
            <Pressable onPress={onClose} accessibilityLabel="Закрыть" accessibilityRole="button" style={styles.close}><ThemedText style={styles.title}>×</ThemedText></Pressable>
          </View>
          <ThemedText themeColor="textSecondary">Вместо: {target?.name ?? 'Вещь недоступна'}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.hint}>{updateExisting ? 'Выбери замену — обновим этот образ без создания копии.' : 'Выбери замену. Остальные вещи останутся в образе.'}</ThemedText>
          <FlatList data={candidates} keyExtractor={(item) => item.id} contentContainerStyle={styles.list}
            ListEmptyComponent={<ThemedText style={styles.empty}>Других вещей этого типа пока нет. Добавь их в гардероб, чтобы выбрать замену.</ThemedText>}
            renderItem={({ item }) => (
              <Pressable accessibilityRole="button" accessibilityLabel={`Выбрать ${item.name}`}
                onPress={() => { if (targetId) onSelect(targetId, item.id); }}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
                <Image source={{ uri: getWardrobeItemDisplayImageUri(item) }} style={styles.image} contentFit="contain" />
                <View style={{ flex: 1 }}><ThemedText style={styles.name}>{item.name}</ThemedText><ThemedText themeColor="textSecondary">{item.category} · {item.color}</ThemedText></View>
                <ThemedText>→</ThemedText>
              </Pressable>
            )} />
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { height: '78%', backgroundColor: Colors.light.background, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 21, fontWeight: '600' },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  hint: { marginTop: 6, marginBottom: 12, fontSize: 14 },
  list: { gap: 8, paddingBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, backgroundColor: Colors.light.backgroundElement, borderRadius: 16 },
  image: { width: 92, height: 100 },
  name: { fontWeight: '600', marginBottom: 4 },
  empty: { paddingVertical: 30, textAlign: 'center', lineHeight: 24 },
});
