import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WardrobeFiltersSheet } from '@/components/wardrobe-filters-sheet';
import { WardrobeGridCard } from '@/components/wardrobe-grid-card';
import { EMPTY_WARDROBE_FILTERS, countWardrobeFilters, filterWardrobe } from '@/utils/wardrobe-filters';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { buildWardrobeImageExtraData } from '@/constants/wardrobe-item';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useWardrobe } from '@/contexts/wardrobe-context';
import { useAddWardrobeItem } from '@/hooks/use-add-wardrobe-item';

const GRID_GAP = Spacing.two;
const NUM_COLUMNS = 2;

export default function GarderobScreen() {
  const { items } = useWardrobe();
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [filters, setFilters] = useState({ ...EMPTY_WARDROBE_FILTERS });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterCount = countWardrobeFilters(filters);
  const visibleItems = filterWardrobe(items, filters, favoritesOnly);
  const { takePhoto, pickFromGallery } = useAddWardrobeItem();
  const [isAddSheetVisible, setIsAddSheetVisible] = useState(false);
  const { width: windowWidth } = useWindowDimensions();

  const contentWidth = Math.min(windowWidth, MaxContentWidth);
  const cardWidth = (contentWidth - Spacing.four * 2 - GRID_GAP) / NUM_COLUMNS;
  const wardrobeImageExtraData = useMemo(() => buildWardrobeImageExtraData(items), [items]);

  const handleSelectCamera = useCallback(async () => {
    setIsAddSheetVisible(false);
    await takePhoto();
  }, [takePhoto]);

  const handleSelectGallery = useCallback(async () => {
    setIsAddSheetVisible(false);
    await pickFromGallery();
  }, [pickFromGallery]);

  const renderItem = useCallback(
    ({ item }: { item: (typeof items)[number] }) => (
      <WardrobeGridCard
        item={item}
        width={cardWidth}
        onPress={() =>
          router.push({
            pathname: '/garderob/[id]',
            params: { id: item.id },
          })
        }
      />
    ),
    [cardWidth],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.titleRow}>
          <ThemedText type="subtitle" style={styles.title}>
            Мой гардероб
          </ThemedText>
          <Pressable
            onPress={() => router.push('/garderob/statistics')}
            style={({ pressed }) => [styles.statisticsLink, pressed && styles.buttonPressed]}>
            <ThemedText style={styles.statisticsLinkText}>Статистика</ThemedText>
          </Pressable>
        </View>

        <Pressable
          onPress={() => setIsAddSheetVisible(true)}
          style={({ pressed }) => [styles.addButton, pressed && styles.buttonPressed]}>
          <ThemedText style={styles.addButtonText}>+ Добавить вещь</ThemedText>
        </Pressable>

        <View style={styles.filterBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: favoritesOnly }}
          accessibilityLabel="Показывать только избранное"
          onPress={() => setFavoritesOnly((current) => !current)}
          style={({ pressed }) => [styles.favoriteFilter, favoritesOnly && styles.favoriteFilterActive, pressed && styles.buttonPressed]}>
          <ThemedText>{favoritesOnly ? '♥' : '♡'} Избранное ({items.filter((item) => item.isFavorite).length})</ThemedText>
        </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Поиск и фильтры. Активно: ${filterCount}`}
            onPress={() => setFiltersOpen(true)} style={({ pressed }) => [styles.filtersButton, filterCount > 0 && styles.favoriteFilterActive, pressed && styles.buttonPressed]}>
            <SymbolView name={{ ios: 'line.3.horizontal.decrease', android: 'filter_list', web: 'filter_list' }} size={22} tintColor={Colors.light.text} />
            {filterCount > 0 && <ThemedText style={styles.filterBadge}>{filterCount}</ThemedText>}
          </Pressable>
        </View>

        {visibleItems.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyTitle}>{items.length === 0 ? 'Гардероб пока пуст' : filterCount > 0 ? 'Ничего не найдено' : 'В избранном пока пусто'}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.emptyHint}>
              {items.length === 0 ? 'Добавь первую вещь, чтобы начать создавать образы.' : filterCount > 0 ? 'Попробуй изменить поиск или фильтры.' : 'Нажми на сердечко в карточке вещи, чтобы добавить её сюда.'}
            </ThemedText>
            {items.length > 0 && <Pressable onPress={() => { setFilters({ ...EMPTY_WARDROBE_FILTERS }); setFavoritesOnly(false); }} style={styles.sheetCancel} accessibilityRole="button"><ThemedText>Показать все вещи</ThemedText></Pressable>}
          </ThemedView>
        ) : (
          <FlatList
            style={styles.list}
            data={visibleItems}
            extraData={wardrobeImageExtraData}
            keyExtractor={(item) => item.id}
            numColumns={NUM_COLUMNS}
            renderItem={renderItem}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>

      {filtersOpen && <WardrobeFiltersSheet filters={filters} items={items} favoritesOnly={favoritesOnly}
        onClose={() => setFiltersOpen(false)} onApply={(next) => { setFilters(next); setFiltersOpen(false); }} />}

      <Modal
        visible={isAddSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddSheetVisible(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setIsAddSheetVisible(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <ThemedText style={styles.sheetTitle}>Добавить вещь</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.sheetSubtitle}>
              Выбери, откуда добавить фотографию
            </ThemedText>

            <Pressable
              onPress={handleSelectCamera}
              style={({ pressed }) => [styles.sheetOption, pressed && styles.buttonPressed]}>
              <ThemedText style={styles.sheetOptionTitle}>📷 Сделать фото</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.sheetOptionHint}>
                Открыть камеру
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={handleSelectGallery}
              style={({ pressed }) => [styles.sheetOption, pressed && styles.buttonPressed]}>
              <ThemedText style={styles.sheetOptionTitle}>🖼 Выбрать из галереи</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.sheetOptionHint}>
                Выбрать существующее фото
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setIsAddSheetVisible(false)}
              style={({ pressed }) => [styles.sheetCancel, pressed && styles.buttonPressed]}>
              <ThemedText style={styles.sheetCancelText}>Отмена</ThemedText>
            </Pressable>
          </Pressable>
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
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.three },
  filtersButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: Colors.light.backgroundElement },
  filterBadge: { position: 'absolute', top: -4, right: -3, minWidth: 20, height: 20, lineHeight: 20, textAlign: 'center', borderRadius: 10, backgroundColor: Colors.light.text, color: Colors.light.background, fontSize: 12 },
  favoriteFilter: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.backgroundElement,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 44,
    justifyContent: 'center',
  },
  favoriteFilterActive: {
    backgroundColor: Colors.light.backgroundElement,
    borderColor: Colors.light.text,
  },
  list: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.three,
    marginBottom: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    flex: 1,
  },
  statisticsLink: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  statisticsLinkText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  addButton: {
    borderWidth: 1.5,
    borderColor: Colors.light.text,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  addButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: Colors.light.text,
  },
  emptyHint: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  grid: {
    paddingBottom: Spacing.four,
  },
  row: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  sheetOverlay: {
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
    gap: Spacing.two,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  sheetSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  sheetOption: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 14,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    gap: Spacing.one,
  },
  sheetOptionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
  },
  sheetOptionHint: {
    fontSize: 14,
    lineHeight: 20,
  },
  sheetCancel: {
    marginTop: Spacing.one,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  sheetCancelText: {
    fontSize: 17,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
});
