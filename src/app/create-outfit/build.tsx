import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getWardrobeItemDisplayImageUri } from '@/constants/wardrobe-item';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useOutfits } from '@/contexts/outfits-context';
import { useWardrobe, type WardrobeItem } from '@/contexts/wardrobe-context';
import {
  applyOutfitItemToggle,
  matchesWardrobeFilter,
  WARDROBE_FILTER_OPTIONS,
  type WardrobeFilterId,
} from '@/utils/wardrobe-category-groups';

const GRID_GAP = Spacing.two;
const NUM_COLUMNS = 2;
const MIN_OUTFIT_ITEMS = 2;
const DEFAULT_MODAL_TITLE = 'Новый образ';
const FALLBACK_SAVE_TITLE = 'Мой образ';
const SELECTED_STRIP_CARD_WIDTH = 120;

function SelectedItemStripCard({
  item,
  onRemove,
}: {
  item: WardrobeItem;
  onRemove: () => void;
}) {
  const displayImageUri = getWardrobeItemDisplayImageUri(item);

  return (
    <View style={styles.stripCard}>
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        style={({ pressed }) => [styles.stripRemoveButton, pressed && styles.buttonPressed]}>
        <ThemedText style={styles.stripRemoveText}>×</ThemedText>
      </Pressable>
      <View style={styles.stripImageWrap}>
        <Image source={{ uri: displayImageUri }} style={styles.stripImage} contentFit="contain" />
      </View>
      <ThemedText style={styles.stripLabel} numberOfLines={2}>
        {item.name}
      </ThemedText>
    </View>
  );
}

function WardrobePickerCard({
  item,
  isSelected,
  cardWidth,
  onToggle,
}: {
  item: WardrobeItem;
  isSelected: boolean;
  cardWidth: number;
  onToggle: () => void;
}) {
  const displayImageUri = getWardrobeItemDisplayImageUri(item);

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.pickerCardPressable,
        { width: cardWidth },
        pressed && styles.buttonPressed,
      ]}>
      <ThemedView style={[styles.pickerCard, isSelected && styles.pickerCardSelected]}>
        <Image source={{ uri: displayImageUri }} style={styles.pickerCardImage} contentFit="cover" />
        <ThemedText style={styles.pickerCardLabel} numberOfLines={2}>
          {item.name}
        </ThemedText>
        {isSelected && (
          <View style={styles.selectedBadge}>
            <ThemedText style={styles.selectedBadgeText}>✓</ThemedText>
          </View>
        )}
      </ThemedView>
    </Pressable>
  );
}

export default function BuildOutfitScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { items, isHydrated } = useWardrobe();
  const { saveOutfit, isOutfitSaved } = useOutfits();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<WardrobeFilterId>('all');
  const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
  const [outfitTitle, setOutfitTitle] = useState(DEFAULT_MODAL_TITLE);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);

  const contentWidth = Math.min(windowWidth, MaxContentWidth);
  const cardWidth = (contentWidth - Spacing.four * 2 - GRID_GAP) / NUM_COLUMNS;

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const filteredItems = useMemo(
    () => items.filter((item) => matchesWardrobeFilter(item.category, activeFilter)),
    [activeFilter, items],
  );

  const selectedItems = useMemo(
    () =>
      selectedIds
        .map((itemId) => itemsById.get(itemId))
        .filter((item): item is WardrobeItem => item !== undefined),
    [itemsById, selectedIds],
  );

  const canSave = selectedItems.length >= MIN_OUTFIT_ITEMS;

  const handleToggleItem = useCallback(
    (itemId: string) => {
      setSelectedIds((current) => applyOutfitItemToggle(current, itemId, itemsById));
      setDuplicateMessage(null);
    },
    [itemsById],
  );

  const handleRemoveItem = useCallback((itemId: string) => {
    setSelectedIds((current) => current.filter((id) => id !== itemId));
    setDuplicateMessage(null);
  }, []);

  const handleCancelSaveModal = () => {
    setIsSaveModalVisible(false);
    setDuplicateMessage(null);
  };

  const handleOpenSaveModal = () => {
    if (!canSave) {
      return;
    }

    setOutfitTitle(DEFAULT_MODAL_TITLE);
    setDuplicateMessage(null);
    setIsSaveModalVisible(true);
  };

  const handleSave = () => {
    const itemIds = selectedItems.map((item) => item.id);

    if (isOutfitSaved(itemIds)) {
      setDuplicateMessage('Такой образ уже сохранён');
      return;
    }

    saveOutfit({
      title: outfitTitle.trim() || FALLBACK_SAVE_TITLE,
      itemIds,
      description: '',
      source: 'manual',
    });

    setIsSaveModalVisible(false);
    router.back();
  };

  const renderPickerItem = useCallback(
    ({ item }: { item: WardrobeItem }) => (
      <WardrobePickerCard
        item={item}
        isSelected={selectedIds.includes(item.id)}
        cardWidth={cardWidth}
        onToggle={() => handleToggleItem(item.id)}
      />
    ),
    [cardWidth, handleToggleItem, selectedIds],
  );

  if (!isHydrated) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centeredState}>
          <ActivityIndicator color={Colors.light.text} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (items.length < MIN_OUTFIT_ITEMS) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.headerBack, pressed && styles.buttonPressed]}>
              <SymbolView
                name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
                size={18}
                tintColor={Colors.light.text}
              />
              <ThemedText style={styles.headerBackText}>Назад</ThemedText>
            </Pressable>
            <ThemedText style={styles.headerTitle}>Создать образ</ThemedText>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.emptyWardrobeState}>
            <ThemedText style={styles.emptyTitle}>Добавьте ещё вещи</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.emptySubtitle}>
              Для создания образа нужно минимум две вещи в гардеробе.
            </ThemedText>
            <Pressable
              onPress={() => router.push('/garderob')}
              style={({ pressed }) => [styles.emptyButton, pressed && styles.buttonPressed]}>
              <ThemedText style={styles.emptyButtonText}>Перейти в гардероб</ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.headerBack, pressed && styles.buttonPressed]}>
            <SymbolView
              name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
              size={18}
              tintColor={Colors.light.text}
            />
            <ThemedText style={styles.headerBackText}>Назад</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>Создать образ</ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.previewSection}>
          <ThemedText themeColor="textSecondary" style={styles.selectionCounter}>
            Выбрано: {selectedItems.length}
          </ThemedText>
          {selectedItems.length === 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.previewPlaceholder}>
              Выберите вещи для образа
            </ThemedText>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.stripRow}>
              {selectedItems.map((item) => (
                <SelectedItemStripCard
                  key={item.id}
                  item={item}
                  onRemove={() => handleRemoveItem(item.id)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
          style={styles.filtersScroll}>
          {WARDROBE_FILTER_OPTIONS.map((filter) => {
            const isActive = activeFilter === filter.id;

            return (
              <Pressable
                key={filter.id}
                onPress={() => setActiveFilter(filter.id)}
                style={({ pressed }) => [
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                  pressed && styles.buttonPressed,
                ]}>
                <ThemedText style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {filter.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        <FlatList
          style={styles.pickerList}
          data={filteredItems}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          renderItem={renderPickerItem}
          columnWrapperStyle={styles.pickerRow}
          contentContainerStyle={[
            styles.pickerGrid,
            { paddingBottom: Math.max(insets.bottom, Spacing.three) + 88 },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.filterEmptyState}>
              <ThemedText themeColor="textSecondary" style={styles.filterEmptyText}>
                Нет вещей в этой категории
              </ThemedText>
            </View>
          }
        />

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
          <Pressable
            onPress={handleOpenSaveModal}
            disabled={!canSave}
            style={({ pressed }) => [
              styles.saveButton,
              !canSave && styles.saveButtonDisabled,
              pressed && canSave && styles.buttonPressed,
            ]}>
            <ThemedText style={[styles.saveButtonText, !canSave && styles.saveButtonTextDisabled]}>
              Сохранить образ
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>

      <Modal
        visible={isSaveModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCancelSaveModal}>
        <Pressable style={styles.saveModalOverlay} onPress={handleCancelSaveModal}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.saveModalKeyboardAvoid}>
            <Pressable style={styles.saveModalSheetPressable} onPress={(event) => event.stopPropagation()}>
              <SafeAreaView edges={['bottom']} style={styles.saveModalSheet}>
                <ThemedText style={styles.saveModalTitle}>Название образа</ThemedText>
                <TextInput
                  value={outfitTitle}
                  onChangeText={setOutfitTitle}
                  style={styles.saveModalInput}
                  placeholder={DEFAULT_MODAL_TITLE}
                  placeholderTextColor={Colors.light.textSecondary}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
                {duplicateMessage && (
                  <ThemedText style={styles.duplicateMessage}>{duplicateMessage}</ThemedText>
                )}
                <View style={styles.saveModalActions}>
                  <Pressable
                    onPress={handleCancelSaveModal}
                    style={({ pressed }) => [styles.saveModalCancelButton, pressed && styles.buttonPressed]}>
                    <ThemedText style={styles.saveModalCancelText}>Отмена</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={handleSave}
                    style={({ pressed }) => [styles.saveModalConfirmButton, pressed && styles.buttonPressed]}>
                    <ThemedText style={styles.saveModalConfirmText}>Сохранить</ThemedText>
                  </Pressable>
                </View>
              </SafeAreaView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  headerBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minWidth: 88,
  },
  headerBackText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
  },
  headerSpacer: {
    minWidth: 88,
  },
  previewSection: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  previewPlaceholder: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingVertical: Spacing.three,
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 16,
  },
  selectionCounter: {
    fontSize: 14,
    lineHeight: 20,
  },
  stripRow: {
    gap: Spacing.two,
    paddingRight: Spacing.two,
  },
  stripCard: {
    width: SELECTED_STRIP_CARD_WIDTH,
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 14,
    padding: Spacing.two,
    position: 'relative',
  },
  stripRemoveButton: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    zIndex: 1,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.backgroundSelected,
  },
  stripRemoveText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  stripImageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: Colors.light.background,
    overflow: 'hidden',
    marginBottom: Spacing.one + 2,
  },
  stripImage: {
    width: '100%',
    height: '100%',
    padding: Spacing.one,
  },
  stripLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.light.text,
    lineHeight: 16,
    minHeight: 32,
  },
  filtersScroll: {
    flexGrow: 0,
    marginBottom: Spacing.two,
  },
  filtersRow: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  filterChip: {
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    backgroundColor: Colors.light.backgroundElement,
  },
  filterChipActive: {
    backgroundColor: Colors.light.text,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
  },
  filterChipTextActive: {
    color: Colors.light.background,
  },
  pickerList: {
    flex: 1,
  },
  pickerGrid: {
    paddingHorizontal: Spacing.four,
    gap: GRID_GAP,
  },
  pickerRow: {
    gap: GRID_GAP,
  },
  pickerCardPressable: {
    marginBottom: GRID_GAP,
  },
  pickerCard: {
    borderRadius: 14,
    backgroundColor: Colors.light.backgroundElement,
    overflow: 'hidden',
    position: 'relative',
  },
  pickerCardSelected: {
    borderWidth: 2,
    borderColor: Colors.light.text,
  },
  pickerCardImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Colors.light.background,
  },
  pickerCardLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.text,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    minHeight: 44,
  },
  selectedBadge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.background,
  },
  filterEmptyState: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  filterEmptyText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    backgroundColor: Colors.light.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.light.backgroundSelected,
  },
  saveButton: {
    backgroundColor: Colors.light.text,
    paddingVertical: Spacing.three,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: Colors.light.backgroundElement,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.background,
  },
  saveButtonTextDisabled: {
    color: Colors.light.textSecondary,
  },
  emptyWardrobeState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: Spacing.two,
    backgroundColor: Colors.light.text,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 14,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.background,
  },
  saveModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  saveModalKeyboardAvoid: {
    width: '100%',
  },
  saveModalSheetPressable: {
    width: '100%',
  },
  saveModalSheet: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  saveModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  saveModalInput: {
    borderWidth: 1,
    borderColor: Colors.light.backgroundSelected,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
    color: Colors.light.text,
    backgroundColor: Colors.light.backgroundElement,
  },
  duplicateMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: '#C0392B',
  },
  saveModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  saveModalCancelButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  saveModalCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  saveModalConfirmButton: {
    flex: 1,
    backgroundColor: Colors.light.text,
    paddingVertical: Spacing.three,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveModalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.background,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
