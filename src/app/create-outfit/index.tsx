import { getOutfitDescription } from '@/utils/outfit-description';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeOutfitPreview } from '@/components/home-outfit-preview';
import { FamilyMemberPickerSheet } from '@/components/family-member-picker-sheet';
import { OutfitReplacementSheet } from '@/components/outfit-replacement-sheet';
import { PrikinIllustration } from '@/components/prikin/prikin-illustration';
import { PRIKIN_OUTFITS_EMPTY_CLOTHES_SVG } from '@/components/prikin/illustrations';
import {
  PrikinBrandHeader,
  PrikinHandwritten,
} from '@/components/prikin/prikin-brand-header';
import { PrikinPrimaryButton } from '@/components/prikin/prikin-primary-button';
import { ThemedText } from '@/components/themed-text';
import type { SavedOutfit } from '@/constants/saved-outfit';
import type { WearEvent } from '@/constants/wear-event';
import { getWardrobeItemDisplayImageUri } from '@/constants/wardrobe-item';
import {
  PrikinColors,
  PrikinRadii,
  PrikinSpacing,
  PrikinTypography,
} from '@/constants/prikin-tokens';
import { MaxContentWidth, Spacing, TabScreenScrollPadding } from '@/constants/theme';
import { useOutfits } from '@/contexts/outfits-context';
import { useAccount } from '@/contexts/account-context';
import { useFamily } from '@/contexts/family-context';
import { useWearHistory } from '@/contexts/wear-history-context';
import { useWardrobe, type WardrobeItem } from '@/contexts/wardrobe-context';
import { canUseFamilyFeatures } from '@/utils/account-capabilities';
import { buildPairedOutfitEntryParams } from '@/utils/paired-outfit-route';
import { resolveWardrobeItemsFromIds } from '@/utils/resolve-wardrobe-items';
import { formatWearEventDate } from '@/utils/wear-date';

function formatSavedOutfitCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  let word = 'образов';
  if (mod10 === 1 && mod100 !== 11) {
    word = 'образ';
  } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    word = 'образа';
  }

  return `${count} ${word}`;
}

function OutfitsEmptyPrompt({
  variant,
}: {
  variant: 'no-wardrobe' | 'no-outfits';
}) {
  const isNoWardrobe = variant === 'no-wardrobe';

  return (
    <View style={styles.emptyPrompt}>
      <View style={styles.emptyHeroRow}>
        <PrikinIllustration
          xml={PRIKIN_OUTFITS_EMPTY_CLOTHES_SVG}
          width={172}
          aspectRatio={190 / 180}
          accessibilityLabel="Иллюстрация футболки и брюк на бумаге"
        />
        <PrikinHandwritten style={styles.emptyHeroHandwritten}>Всё сложится</PrikinHandwritten>
      </View>

      <Text style={styles.emptyTitle}>Твои сочетания — здесь</Text>
      <Text style={styles.emptySubtitle}>
        {isNoWardrobe
          ? 'Добавь вещи в гардероб — и мы соберём первые образы. Любимые можно будет сохранить.'
          : 'Собери образ из вещей в гардеробе и сохрани понравившийся вариант.'}
      </Text>

      <PrikinPrimaryButton
        label={isNoWardrobe ? 'Добавить вещи' : 'Создать образ'}
        onPress={() => router.push(isNoWardrobe ? '/garderob' : '/create-outfit/build')}
        style={styles.emptyCtaButton}
      />
    </View>
  );
}

function SavedOutfitCard({
  outfit,
  wardrobeById,
  isWornToday,
  duplicateHintVisible,
  onOpenDetail,
  onOpenMenu,
  onWearToday,
}: {
  outfit: SavedOutfit;
  wardrobeById: Map<string, WardrobeItem>;
  isWornToday: boolean;
  duplicateHintVisible: boolean;
  onOpenDetail: () => void;
  onOpenMenu: () => void;
  onWearToday: () => void;
}) {
  const outfitItems = resolveWardrobeItemsFromIds(outfit.itemIds, wardrobeById);
  const [replacementTarget, setReplacementTarget] = useState<string | null>(null);
  const { items } = useWardrobe();
  const { replaceSavedItem } = useOutfits();

  if (outfitItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.outfitCard}>
      <View style={styles.outfitCardHeader}>
        <Pressable
          onPress={onOpenDetail}
          style={({ pressed }) => [styles.outfitTitlePressable, pressed && styles.buttonPressed]}>
          <Text style={styles.outfitTitle} numberOfLines={2}>
            {outfit.title}
          </Text>
        </Pressable>
        <Pressable
          onPress={onOpenMenu}
          style={({ pressed }) => [styles.menuButton, pressed && styles.buttonPressed]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Меню образа">
          <Text style={styles.menuButtonText}>•••</Text>
        </Pressable>
      </View>

      <Pressable onPress={onOpenDetail} style={({ pressed }) => pressed && styles.buttonPressed}>
        <HomeOutfitPreview items={outfitItems} onReplace={setReplacementTarget} compact />
      </Pressable>
      <OutfitReplacementSheet
        targetId={replacementTarget}
        itemIds={outfit.itemIds}
        wardrobe={items}
        updateExisting
        onClose={() => setReplacementTarget(null)}
        onSelect={(target, replacement) => {
          replaceSavedItem(outfit.id, target, replacement);
          setReplacementTarget(null);
        }}
      />

      {outfitItems.length > 0 && (
        <Text style={styles.outfitDescription} numberOfLines={2} ellipsizeMode="tail">
          {getOutfitDescription(outfit.description, outfitItems, outfit.source)}
        </Text>
      )}

      <View style={styles.wearActionRow}>
        <Pressable
          onPress={onWearToday}
          style={({ pressed }) => [
            styles.wearButton,
            isWornToday && styles.wearButtonActive,
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button">
          <Text style={[styles.wearButtonText, isWornToday && styles.wearButtonTextActive]}>
            {isWornToday ? '✓ Надето сегодня' : 'Надеть сегодня'}
          </Text>
        </Pressable>
        {duplicateHintVisible && (
          <Text style={styles.duplicateHint}>
            Этот образ уже отмечен как надетый сегодня
          </Text>
        )}
      </View>
    </View>
  );
}

function RecentWearEventRow({
  event,
  title,
  wardrobeById,
}: {
  event: WearEvent;
  title: string;
  wardrobeById: Map<string, WardrobeItem>;
}) {
  const previewItems = resolveWardrobeItemsFromIds(event.itemIds, wardrobeById).slice(0, 4);

  return (
    <View style={styles.recentWearRow}>
      {previewItems.length > 0 ? (
        <View style={styles.recentWearThumbGrid}>
          {previewItems.map((item) => (
            <View key={item.id} style={styles.recentWearThumbWrap}>
              <Image
                source={{ uri: getWardrobeItemDisplayImageUri(item) }}
                style={styles.recentWearThumb}
                contentFit="contain"
              />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.recentWearThumbPlaceholder} />
      )}
      <View style={styles.recentWearMeta}>
        <Text style={styles.recentWearTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.recentWearDate}>{formatWearEventDate(event.wornAt)}</Text>
      </View>
    </View>
  );
}

function RecentWearEmptySection() {
  return (
    <View style={styles.recentWearSection}>
      <Text style={styles.recentWearSectionTitle}>Недавно надевала</Text>
      <View style={styles.sectionHairline} />
      <Text style={styles.recentWearEmptyText}>
        Здесь появятся образы, которые ты отметишь кнопкой «Надеть сегодня».
      </Text>
    </View>
  );
}

function RecentWearSection({
  events,
  savedOutfitsById,
  wardrobeById,
}: {
  events: WearEvent[];
  savedOutfitsById: Map<string, SavedOutfit>;
  wardrobeById: Map<string, WardrobeItem>;
}) {
  if (events.length === 0) {
    return null;
  }

  return (
    <View style={styles.recentWearSection}>
      <Text style={styles.recentWearSectionTitle}>Недавно носили</Text>
      <View style={styles.sectionHairline} />
      <View style={styles.recentWearList}>
        {events.map((event) => {
          const savedOutfit = savedOutfitsById.get(event.outfitId);
          const title = savedOutfit?.title ?? 'Удалённый образ';

          return (
            <RecentWearEventRow
              key={event.id}
              event={event}
              title={title}
              wardrobeById={wardrobeById}
            />
          );
        })}
      </View>
    </View>
  );
}

const RECENT_WEAR_PREVIEW_COUNT = 3;
const DUPLICATE_HINT_DURATION_MS = 2500;

export default function CreateOutfitScreen() {
  const insets = useSafeAreaInsets();
  const { items, isHydrated: isWardrobeHydrated } = useWardrobe();
  const { user } = useAccount();
  const { members } = useFamily();
  const { savedOutfits, isHydrated: isOutfitsHydrated, removeOutfit } = useOutfits();
  const {
    wearEvents,
    isHydrated: isWearHistoryHydrated,
    markOutfitWorn,
    isOutfitWornToday,
  } = useWearHistory();
  const [menuOutfitId, setMenuOutfitId] = useState<string | null>(null);
  const [duplicateHintOutfitId, setDuplicateHintOutfitId] = useState<string | null>(null);
  const [isFamilyPickerVisible, setIsFamilyPickerVisible] = useState(false);

  const wardrobeById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const savedOutfitsById = useMemo(
    () => new Map(savedOutfits.map((outfit) => [outfit.id, outfit])),
    [savedOutfits],
  );

  const visibleOutfits = useMemo(
    () =>
      savedOutfits.filter(
        (outfit) => resolveWardrobeItemsFromIds(outfit.itemIds, wardrobeById).length > 0,
      ),
    [savedOutfits, wardrobeById],
  );

  const savedOutfitCountLabel = useMemo(
    () => formatSavedOutfitCountLabel(visibleOutfits.length),
    [visibleOutfits.length],
  );

  const menuOutfit = menuOutfitId
    ? visibleOutfits.find((outfit) => outfit.id === menuOutfitId) ?? null
    : null;

  const recentWearEvents = useMemo(() => wearEvents.slice(0, RECENT_WEAR_PREVIEW_COUNT), [wearEvents]);

  const emptyVariant =
    items.length === 0 ? 'no-wardrobe' : visibleOutfits.length === 0 ? 'no-outfits' : null;

  useEffect(() => {
    if (!duplicateHintOutfitId) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setDuplicateHintOutfitId(null);
    }, DUPLICATE_HINT_DURATION_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [duplicateHintOutfitId]);

  const handleWearToday = (outfit: SavedOutfit) => {
    const result = markOutfitWorn(outfit);

    if (result === 'already_today') {
      setDuplicateHintOutfitId(outfit.id);
    }
  };

  const handleDeleteFromMenu = () => {
    if (menuOutfitId) {
      removeOutfit(menuOutfitId);
      setMenuOutfitId(null);
    }
  };

  const handleCreatePairedOutfit = () => {
    if (!canUseFamilyFeatures(user)) {
      Alert.alert(
        'Нужен сохранённый аккаунт',
        'Подключите email или телефон, чтобы создавать совместные образы.',
      );
      return;
    }

    if (members.length === 0) {
      Alert.alert('Добавьте члена семьи', 'Сначала добавьте близкого в профиле.');
      return;
    }

    setIsFamilyPickerVisible(true);
  };

  const handleFamilyMemberSelected = (memberPublicId: string) => {
    router.push({
      pathname: '/profile/family/[publicId]/paired-outfit',
      params: buildPairedOutfitEntryParams({ memberPublicId }),
    });
  };

  if (!isWardrobeHydrated || !isOutfitsHydrated || !isWearHistoryHydrated) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.centeredState}>
          <ActivityIndicator color={PrikinColors.textPrimary} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <PrikinBrandHeader />

        <View style={styles.titleBlock}>
          <Text style={styles.screenTitle}>Мои образы</Text>
          <Text style={styles.outfitCount}>{savedOutfitCountLabel}</Text>
        </View>

        {items.length > 0 && (
          <View style={styles.topActions}>
            <PrikinPrimaryButton
              label="+ Создать образ"
              onPress={() => router.push('/create-outfit/build')}
              style={styles.topActionButton}
            />
            <PrikinPrimaryButton
              label="Вместе с членом семьи"
              variant="outline"
              onPress={handleCreatePairedOutfit}
              style={styles.topActionButton}
            />
          </View>
        )}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            emptyVariant !== null && styles.scrollContentEmpty,
            { paddingBottom: TabScreenScrollPadding },
          ]}
          showsVerticalScrollIndicator={false}>
          {emptyVariant !== null ? (
            <>
              <OutfitsEmptyPrompt variant={emptyVariant} />
              {recentWearEvents.length === 0 ? (
                <RecentWearEmptySection />
              ) : (
                <RecentWearSection
                  events={recentWearEvents}
                  savedOutfitsById={savedOutfitsById}
                  wardrobeById={wardrobeById}
                />
              )}
            </>
          ) : (
            <>
              <RecentWearSection
                events={recentWearEvents}
                savedOutfitsById={savedOutfitsById}
                wardrobeById={wardrobeById}
              />
              {visibleOutfits.map((outfit) => (
              <SavedOutfitCard
                key={outfit.id}
                outfit={outfit}
                wardrobeById={wardrobeById}
                isWornToday={isOutfitWornToday(outfit.id)}
                duplicateHintVisible={duplicateHintOutfitId === outfit.id}
                onOpenDetail={() =>
                  router.push({
                    pathname: '/create-outfit/[id]',
                    params: { id: outfit.id },
                  })
                }
                onOpenMenu={() => setMenuOutfitId(outfit.id)}
                onWearToday={() => handleWearToday(outfit)}
              />
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={menuOutfit !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOutfitId(null)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOutfitId(null)}>
          <View style={[styles.menuSheet, { top: insets.top + PrikinSpacing.sectionGap / 2 }]}>
            <Pressable
              onPress={handleDeleteFromMenu}
              style={({ pressed }) => [styles.menuOption, pressed && styles.buttonPressed]}>
              <ThemedText style={styles.menuOptionDelete}>Удалить из сохранённых</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <FamilyMemberPickerSheet
        visible={isFamilyPickerVisible}
        onClose={() => setIsFamilyPickerVisible(false)}
        onSelect={handleFamilyMemberSelected}
      />
    </View>
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
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    gap: 4,
    marginBottom: PrikinSpacing.sectionGap / 2,
  },
  screenTitle: {
    ...PrikinTypography.screenTitle,
  },
  outfitCount: {
    ...PrikinTypography.bodySecondary,
  },
  topActions: {
    gap: PrikinSpacing.welcomeActionsGap / 2,
    marginBottom: PrikinSpacing.sectionGap / 2,
  },
  topActionButton: {
    alignSelf: 'stretch',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: PrikinSpacing.sectionGap,
    paddingBottom: PrikinSpacing.sectionGap,
  },
  scrollContentEmpty: {
    flexGrow: 1,
  },
  emptyPrompt: {
    alignItems: 'stretch',
    gap: PrikinSpacing.sectionGap,
    paddingTop: PrikinSpacing.sectionGap / 4,
  },
  emptyHeroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: Spacing.three,
    flexWrap: 'wrap',
  },
  emptyHeroHandwritten: {
    flexShrink: 1,
    maxWidth: 150,
    transform: [{ rotate: '-12deg' }],
  },
  emptyTitle: {
    ...PrikinTypography.sectionTitle,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...PrikinTypography.body,
    color: PrikinColors.textSecondary,
    textAlign: 'center',
  },
  emptyCtaButton: {
    alignSelf: 'stretch',
  },
  outfitCard: {
    backgroundColor: PrikinColors.surface,
    borderRadius: PrikinRadii.card,
    padding: PrikinSpacing.cardPadding,
    gap: PrikinSpacing.sectionGap / 2,
    width: '100%',
    alignSelf: 'stretch',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PrikinColors.borderSubtle,
  },
  outfitCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  outfitTitlePressable: {
    flex: 1,
  },
  outfitTitle: {
    ...PrikinTypography.sectionTitle,
  },
  outfitDescription: {
    ...PrikinTypography.bodySecondary,
    flexShrink: 1,
    width: '100%',
  },
  wearActionRow: {
    gap: 4,
  },
  wearButton: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: PrikinColors.buttonPrimary,
    paddingVertical: 10,
    paddingHorizontal: PrikinSpacing.cardPadding,
    borderRadius: PrikinRadii.input,
  },
  wearButtonActive: {
    borderColor: PrikinColors.textSecondary,
    backgroundColor: PrikinColors.paper,
  },
  wearButtonText: {
    ...PrikinTypography.caption,
    fontWeight: '600',
    color: PrikinColors.textPrimary,
  },
  wearButtonTextActive: {
    color: PrikinColors.textSecondary,
  },
  duplicateHint: {
    ...PrikinTypography.bodySecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  recentWearSection: {
    gap: PrikinSpacing.welcomeActionsGap / 2,
  },
  recentWearSectionTitle: {
    ...PrikinTypography.sectionTitle,
  },
  recentWearEmptyText: {
    ...PrikinTypography.bodySecondary,
    lineHeight: 22,
  },
  sectionHairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PrikinColors.divider,
    alignSelf: 'stretch',
  },
  recentWearList: {
    gap: PrikinSpacing.welcomeActionsGap / 2,
  },
  recentWearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: PrikinColors.surface,
    borderRadius: PrikinRadii.input,
    padding: PrikinSpacing.cardPadding - 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PrikinColors.borderSubtle,
  },
  recentWearThumbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    width: 52,
  },
  recentWearThumbWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: PrikinColors.background,
    overflow: 'hidden',
  },
  recentWearThumb: {
    width: '100%',
    height: '100%',
  },
  recentWearThumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: PrikinColors.paper,
  },
  recentWearMeta: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  recentWearTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: PrikinColors.textPrimary,
  },
  recentWearDate: {
    ...PrikinTypography.bodySecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  menuButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  menuButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: PrikinColors.textSecondary,
    letterSpacing: 1,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: PrikinColors.scrim,
  },
  menuSheet: {
    position: 'absolute',
    right: PrikinSpacing.screenHorizontal,
    minWidth: 220,
    backgroundColor: PrikinColors.surface,
    borderRadius: PrikinRadii.input,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PrikinColors.borderSubtle,
  },
  menuOption: {
    paddingVertical: 14,
    paddingHorizontal: PrikinSpacing.cardPadding,
  },
  menuOptionDelete: {
    fontSize: 16,
    fontWeight: '500',
    color: '#C0392B',
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
