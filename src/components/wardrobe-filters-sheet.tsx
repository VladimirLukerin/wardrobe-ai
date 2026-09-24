import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { PrikinColors, PrikinRadii } from '@/constants/prikin-tokens';
import type { WardrobeItem } from '@/contexts/wardrobe-context';
import { WARDROBE_FILTER_OPTIONS } from '@/utils/wardrobe-category-groups';
import { EMPTY_WARDROBE_FILTERS, filterWardrobe, type WardrobeFilters } from '@/utils/wardrobe-filters';

type Props = { filters: WardrobeFilters; items: WardrobeItem[]; favoritesOnly: boolean; onApply: (filters: WardrobeFilters) => void; onClose: () => void };
export function WardrobeFiltersSheet({ filters, items, favoritesOnly, onApply, onClose }: Props) {
  // Mounted only while open: close dismisses the draft; apply commits all fields together.
  const [draft, setDraft] = useState(filters);
  const insets = useSafeAreaInsets();
  const colors = [...new Set(items.map((item) => item.color).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
  const count = filterWardrobe(items, draft, favoritesOnly).length;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Закрыть фильтры" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}><ThemedText style={styles.title}>Поиск и фильтры</ThemedText><Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Закрыть"><ThemedText style={styles.title}>×</ThemedText></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <TextInput value={draft.query} onChangeText={(query) => setDraft((value) => ({ ...value, query }))} placeholder="Название вещи" placeholderTextColor={Colors.light.textSecondary} accessibilityLabel="Поиск вещи" autoCorrect={false} returnKeyType="search" style={styles.input} />
            <ThemedText style={styles.label}>Категория</ThemedText>
            <View style={styles.options}>{WARDROBE_FILTER_OPTIONS.map((option) => <Pressable key={option.id} onPress={() => setDraft((value) => ({ ...value, category: option.id }))} accessibilityRole="button" accessibilityState={{ selected: draft.category === option.id }} style={[styles.chip, draft.category === option.id && styles.selected]}><ThemedText style={styles.text}>{option.label}</ThemedText></Pressable>)}</View>
            <ThemedText style={styles.label}>Цвет</ThemedText>
            <View style={styles.options}>{[null, ...colors].map((color) => <Pressable key={color ?? 'all-colors'} onPress={() => setDraft((value) => ({ ...value, color }))} accessibilityRole="button" accessibilityState={{ selected: draft.color === color }} style={[styles.chip, draft.color === color && styles.selected]}><ThemedText style={styles.text}>{color ?? 'Все цвета'}</ThemedText></Pressable>)}</View>
            {favoritesOnly && <ThemedText style={styles.hint}>Поиск только среди избранных вещей</ThemedText>}
            {count === 0 && <ThemedText style={styles.hint}>Совпадений нет. Попробуй другой цвет или категорию.</ThemedText>}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable onPress={() => setDraft({ ...EMPTY_WARDROBE_FILTERS })} style={styles.reset} accessibilityRole="button"><ThemedText style={styles.text}>Сбросить</ThemedText></Pressable>
            <Pressable onPress={() => onApply(draft)} style={styles.apply} accessibilityRole="button"><ThemedText style={styles.applyText}>Показать ({count})</ThemedText></Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { maxHeight: '88%', backgroundColor: Colors.light.background, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 21, fontWeight: '600', color: Colors.light.text },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  content: { gap: 12, paddingBottom: 20 },
  input: { borderRadius: 14, backgroundColor: Colors.light.backgroundElement, padding: 14, fontSize: 16, color: Colors.light.text, minHeight: 48 },
  label: { fontSize: 16, fontWeight: '600', marginTop: 8, color: Colors.light.text },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, minHeight: 44, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: Colors.light.backgroundSelected },
  selected: { backgroundColor: PrikinColors.paper, borderColor: PrikinColors.accent },
  text: { fontSize: 14, color: Colors.light.text },
  hint: { fontSize: 14, color: Colors.light.textSecondary },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8 },
  reset: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  apply: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: PrikinColors.buttonPrimary, borderRadius: PrikinRadii.button },
  applyText: { color: PrikinColors.buttonPrimaryText, fontWeight: '600' },
});
