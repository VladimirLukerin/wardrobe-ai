import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeBrandHeader } from '@/components/home-brand-header';
import {
  PrikinHandwritten,
  PrikinTerracottaDot,
} from '@/components/prikin/prikin-brand-header';
import { PrikinIllustration } from '@/components/prikin/prikin-illustration';
import { PRIKIN_WARDROBE_EMPTY_HANGER_SVG } from '@/components/prikin/illustrations';
import { PrikinPrimaryButton } from '@/components/prikin/prikin-primary-button';
import { WardrobeFiltersSheet } from '@/components/wardrobe-filters-sheet';
import { WardrobeGridCard } from '@/components/wardrobe-grid-card';
import { PhotoCaptureOnboardingSheet } from '@/components/photo-capture-onboarding-sheet';
import { EMPTY_WARDROBE_FILTERS, countWardrobeFilters, filterWardrobe } from '@/utils/wardrobe-filters';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { buildWardrobeImageExtraData } from '@/constants/wardrobe-item';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  PrikinColors,
  PrikinRadii,
  PrikinSpacing,
  PrikinTypography,
} from '@/constants/prikin-tokens';
import { useWardrobe } from '@/contexts/wardrobe-context';
import { useAddWardrobeItem } from '@/hooks/use-add-wardrobe-item';

const GRID_GAP = Spacing.two;
const NUM_COLUMNS = 2;

function formatWardrobeItemCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} вещь`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${count} вещи`;
  }

  return `${count} вещей`;
}

export default function GarderobScreen() {
  const { items } = useWardrobe();
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [filters, setFilters] = useState({ ...EMPTY_WARDROBE_FILTERS });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterCount = countWardrobeFilters(filters);
  const visibleItems = filterWardrobe(items, filters, favoritesOnly);
  const favoriteCount = useMemo(() => items.filter((item) => item.isFavorite).length, [items]);
  const wardrobeCountLabel = useMemo(() => formatWardrobeItemCount(items.length), [items.length]);
  const {
    takePhoto,
    pickFromGallery,
    isPhotoOnboardingVisible,
    handlePhotoOnboardingContinue,
    handlePhotoOnboardingSkipForever,
    handlePhotoOnboardingClose,
  } = useAddWardrobeItem();
  const [isAddSheetVisible, setIsAddSheetVisible] = useState(false);
  const { width: windowWidth } = useWindowDimensions();

  const contentWidth = Math.min(windowWidth, MaxContentWidth);
  const horizontalPadding = PrikinSpacing.screenHorizontal;
  const cardWidth = (contentWidth - horizontalPadding * 2 - GRID_GAP) / NUM_COLUMNS;
  const wardrobeImageExtraData = useMemo(() => buildWardrobeImageExtraData(items), [items]);

  const handleSelectCamera = useCallback(async () => {
    setIsAddSheetVisible(false);
    await takePhoto();
  }, [takePhoto]);

  const handleSelectGallery = useCallback(async () => {
    setIsAddSheetVisible(false);
    await pickFromGallery();
  }, [pickFromGallery]);

  const openAddSheet = useCallback(() => setIsAddSheetVisible(true), []);

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

  const isTrulyEmpty = items.length === 0;

  const filteredEmptyTitle =
    filterCount > 0 ? 'Ничего не найдено' : 'В избранном пока пусто';
  const filteredEmptyHint =
    filterCount > 0
      ? 'Попробуй изменить поиск или фильтры.'
      : 'Нажми на сердечко в карточке вещи, чтобы добавить её сюда.';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <HomeBrandHeader />

        <View style={styles.titleBlock}>
          <Text style={styles.screenTitle}>Мой гардероб</Text>
          <Text style={styles.itemCount}>{wardrobeCountLabel}</Text>
          {!isTrulyEmpty ? (
            <Pressable
              onPress={() => router.push('/garderob/statistics')}
              accessibilityRole="link"
              accessibilityLabel="Статистика гардероба"
              style={({ pressed }) => [styles.statisticsLink, pressed && styles.buttonPressed]}>
              <Text style={styles.statisticsLinkText}>Статистика</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.filterBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: favoritesOnly }}
            accessibilityLabel="Показывать только избранное"
            onPress={() => setFavoritesOnly((current) => !current)}
            style={({ pressed }) => [
              styles.favoriteFilter,
              favoritesOnly && styles.favoriteFilterActive,
              pressed && styles.buttonPressed,
            ]}>
            <SymbolView
              name={{
                ios: favoritesOnly ? 'heart.fill' : 'heart',
                android: favoritesOnly ? 'favorite' : 'favorite_border',
                web: favoritesOnly ? 'favorite' : 'favorite_border',
              }}
              size={18}
              tintColor={favoritesOnly ? PrikinColors.textPrimary : PrikinColors.textSecondary}
            />
            <Text style={[styles.favoriteFilterText, favoritesOnly && styles.favoriteFilterTextActive]}>
              Избранное · {favoriteCount}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Поиск и фильтры. Активно: ${filterCount}`}
            onPress={() => setFiltersOpen(true)}
            style={({ pressed }) => [
              styles.filtersButton,
              filterCount > 0 && styles.filtersButtonActive,
              pressed && styles.buttonPressed,
            ]}>
            <SymbolView
              name={{ ios: 'line.3.horizontal.decrease', android: 'filter_list', web: 'filter_list' }}
              size={22}
              tintColor={PrikinColors.textPrimary}
            />
            {filterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{filterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {visibleItems.length === 0 ? (
          isTrulyEmpty ? (
            <View style={styles.emptyWardrobe}>
              <View style={styles.emptyHeroRow}>
                <PrikinIllustration
                  xml={PRIKIN_WARDROBE_EMPTY_HANGER_SVG}
                  width={168}
                  aspectRatio={180 / 190}
                  accessibilityLabel="Иллюстрация вешалки на бумаге"
                  style={styles.emptyHeroIllustration}
                />
                <PrikinHandwritten style={styles.emptyHeroHandwritten}>Начнём с любимого</PrikinHandwritten>
              </View>
              <Text style={styles.emptyTitle}>Здесь будут твои вещи</Text>
              <Text style={styles.emptySubtitle}>
                Добавь первую — и мы поможем сочетать её с остальными.
              </Text>
              <PrikinPrimaryButton
                label="Добавить вещь"
                onPress={openAddSheet}
                style={styles.emptyAddButton}
              />
              <Text style={styles.emptyFootnote}>
                Сфотографируй или выбери фото из галереи
              </Text>
            </View>
          ) : (
            <View style={styles.filteredEmptyState}>
              <Text style={styles.emptyTitle}>{filteredEmptyTitle}</Text>
              <Text style={styles.emptySubtitle}>{filteredEmptyHint}</Text>
              <Pressable
                onPress={() => {
                  setFilters({ ...EMPTY_WARDROBE_FILTERS });
                  setFavoritesOnly(false);
                }}
                style={({ pressed }) => [styles.showAllLink, pressed && styles.buttonPressed]}
                accessibilityRole="button">
                <Text style={styles.showAllLinkText}>Показать все вещи</Text>
              </Pressable>
            </View>
          )
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

      <PhotoCaptureOnboardingSheet
        visible={isPhotoOnboardingVisible}
        onContinue={handlePhotoOnboardingContinue}
        onSkipForever={handlePhotoOnboardingSkipForever}
        onClose={handlePhotoOnboardingClose}
      />

      {filtersOpen && (
        <WardrobeFiltersSheet
          filters={filters}
          items={items}
          favoritesOnly={favoritesOnly}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => {
            setFilters(next);
            setFiltersOpen(false);
          }}
        />
      )}

      <Modal
        visible={isAddSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddSheetVisible(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setIsAddSheetVisible(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.sheetTitle}>Добавить вещь</Text>
            <Text style={styles.sheetSubtitle}>Выбери, откуда добавить фотографию</Text>

            <Pressable
              onPress={handleSelectCamera}
              style={({ pressed }) => [styles.sheetOption, pressed && styles.buttonPressed]}>
              <View style={styles.sheetOptionTitleRow}>
                <SymbolView
                  name={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }}
                  size={22}
                  tintColor={PrikinColors.textPrimary}
                />
                <Text style={styles.sheetOptionTitle}>Сделать фото</Text>
              </View>
              <ThemedText themeColor="textSecondary" style={styles.sheetOptionHint}>
                Открыть камеру
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={handleSelectGallery}
              style={({ pressed }) => [styles.sheetOption, pressed && styles.buttonPressed]}>
              <View style={styles.sheetOptionTitleRow}>
                <SymbolView
                  name={{ ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' }}
                  size={22}
                  tintColor={PrikinColors.textPrimary}
                />
                <Text style={styles.sheetOptionTitle}>Выбрать из галереи</Text>
              </View>
              <ThemedText themeColor="textSecondary" style={styles.sheetOptionHint}>
                Выбрать существующее фото
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setIsAddSheetVisible(false)}
              style={({ pressed }) => [styles.sheetCancel, pressed && styles.buttonPressed]}>
              <Text style={styles.sheetCancelText}>Отмена</Text>
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
    backgroundColor: PrikinColors.background,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: PrikinSpacing.screenHorizontal,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  titleBlock: {
    gap: 4,
    marginBottom: PrikinSpacing.sectionGap,
  },
  screenTitle: {
    ...PrikinTypography.screenTitle,
  },
  itemCount: {
    ...PrikinTypography.bodySecondary,
  },
  statisticsLink: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    marginTop: 2,
  },
  statisticsLinkText: {
    ...PrikinTypography.caption,
    color: PrikinColors.textMuted,
    textDecorationLine: 'underline',
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  favoriteFilter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PrikinColors.borderSubtle,
    borderRadius: PrikinRadii.pill,
    paddingHorizontal: PrikinSpacing.cardPadding,
    paddingVertical: 12,
    minHeight: 44,
    backgroundColor: PrikinColors.surface,
  },
  favoriteFilterActive: {
    backgroundColor: PrikinColors.paper,
    borderColor: PrikinColors.textPrimary,
  },
  favoriteFilterText: {
    ...PrikinTypography.body,
    fontSize: 15,
    color: PrikinColors.textSecondary,
  },
  favoriteFilterTextActive: {
    color: PrikinColors.textPrimary,
    fontWeight: '600',
  },
  filtersButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PrikinColors.borderSubtle,
    backgroundColor: PrikinColors.surface,
  },
  filtersButtonActive: {
    backgroundColor: PrikinColors.paper,
    borderColor: PrikinColors.textPrimary,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -3,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: PrikinColors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: PrikinColors.buttonPrimaryText,
    lineHeight: 16,
  },
  list: {
    flex: 1,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  emptyWardrobe: {
    flex: 1,
    gap: PrikinSpacing.sectionGap,
    paddingTop: Spacing.two,
  },
  emptyHeroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: Spacing.three,
    flexWrap: 'wrap',
  },
  emptyHeroIllustration: {
    flexShrink: 0,
  },
  emptyHeroHandwritten: {
    flexShrink: 1,
    maxWidth: 160,
    transform: [{ rotate: '-12deg' }],
  },
  emptyFootnote: {
    ...PrikinTypography.caption,
    textAlign: 'center',
    color: PrikinColors.textSecondary,
  },
  emptyAddButton: {
    alignSelf: 'stretch',
  },
  emptyTitle: {
    ...PrikinTypography.sectionTitle,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...PrikinTypography.bodySecondary,
    textAlign: 'center',
  },
  filteredEmptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  showAllLink: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.two,
  },
  showAllLinkText: {
    ...PrikinTypography.textAction,
    color: PrikinColors.textPrimary,
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
    backgroundColor: PrikinColors.scrim,
  },
  sheet: {
    backgroundColor: PrikinColors.surface,
    borderTopLeftRadius: PrikinRadii.sheet,
    borderTopRightRadius: PrikinRadii.sheet,
    paddingHorizontal: PrikinSpacing.screenHorizontal,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
  },
  sheetTitle: {
    ...PrikinTypography.sheetTitle,
    color: PrikinColors.textPrimary,
    textAlign: 'center',
  },
  sheetSubtitle: {
    ...PrikinTypography.bodySecondary,
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  sheetOption: {
    backgroundColor: PrikinColors.background,
    borderRadius: PrikinRadii.input,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    gap: Spacing.one,
  },
  sheetOptionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sheetOptionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: PrikinColors.textPrimary,
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
    ...PrikinTypography.textAction,
    color: PrikinColors.textSecondary,
  },
});
