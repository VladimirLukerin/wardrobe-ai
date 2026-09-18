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
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeOutfitPreview } from '@/components/home-outfit-preview';
import { FamilyMemberPickerSheet } from '@/components/family-member-picker-sheet';
import { OutfitReplacementSheet } from '@/components/outfit-replacement-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { SavedOutfit } from '@/constants/saved-outfit';
import type { WearEvent } from '@/constants/wear-event';
import { getWardrobeItemDisplayImageUri } from '@/constants/wardrobe-item';
import { Colors, MaxContentWidth, Spacing, TabScreenScrollPadding } from '@/constants/theme';
import { useOutfits } from '@/contexts/outfits-context';
import { useAccount } from '@/contexts/account-context';
import { useFamily } from '@/contexts/family-context';
import { useWearHistory } from '@/contexts/wear-history-context';
import { useWardrobe, type WardrobeItem } from '@/contexts/wardrobe-context';
import { canUseFamilyFeatures } from '@/utils/account-capabilities';
import { buildPairedOutfitEntryParams } from '@/utils/paired-outfit-route';
import { resolveWardrobeItemsFromIds } from '@/utils/resolve-wardrobe-items';
import { formatWearEventDate } from '@/utils/wear-date';

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
          <ThemedText style={styles.outfitTitle} numberOfLines={2}>
            {outfit.title}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={onOpenMenu}
          style={({ pressed }) => [styles.menuButton, pressed && styles.buttonPressed]}
          hitSlop={8}>
          <ThemedText style={styles.menuButtonText}>•••</ThemedText>
        </Pressable>
      </View>

      <Pressable onPress={onOpenDetail} style={({ pressed }) => pressed && styles.buttonPressed}>
        <HomeOutfitPreview items={outfitItems} onReplace={setReplacementTarget} compact />
      </Pressable>
      <OutfitReplacementSheet targetId={replacementTarget} itemIds={outfit.itemIds} wardrobe={items} updateExisting
        onClose={() => setReplacementTarget(null)} onSelect={(target, replacement) => {
          replaceSavedItem(outfit.id, target, replacement);
          setReplacementTarget(null);
        }} />

      {outfitItems.length > 0 && (
        <ThemedText
          themeColor="textSecondary"
          style={styles.outfitDescription}
          numberOfLines={2}
          ellipsizeMode="tail">
          {getOutfitDescription(outfit.description, outfitItems, outfit.source)}
        </ThemedText>
      )}

      <View style={styles.wearActionRow}>
        <Pressable
          onPress={onWearToday}
          style={({ pressed }) => [
            styles.wearButton,
            isWornToday && styles.wearButtonActive,
            pressed && styles.buttonPressed,
          ]}>
          <ThemedText
            style={[styles.wearButtonText, isWornToday && styles.wearButtonTextActive]}>
            {isWornToday ? '✓ Надето сегодня' : 'Надеть сегодня'}
          </ThemedText>
        </Pressable>
        {duplicateHintVisible && (
          <ThemedText themeColor="textSecondary" style={styles.duplicateHint}>
            Этот образ уже отмечен как надетый сегодня
          </ThemedText>
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
        <ThemedText style={styles.recentWearTitle} numberOfLines={2}>
          {title}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.recentWearDate}>
          {formatWearEventDate(event.wornAt)}
        </ThemedText>
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

  const menuOutfit = menuOutfitId
    ? visibleOutfits.find((outfit) => outfit.id === menuOutfitId) ?? null
    : null;

  const recentWearEvents = useMemo(() => wearEvents.slice(0, RECENT_WEAR_PREVIEW_COUNT), [wearEvents]);

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
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centeredState}>
          <ActivityIndicator color={Colors.light.text} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="subtitle" style={styles.title}>
          Мои образы
        </ThemedText>

        <Pressable
          onPress={() => router.push('/create-outfit/build')}
          style={({ pressed }) => [styles.createButton, pressed && styles.buttonPressed]}>
          <ThemedText style={styles.createButtonText}>+ Создать образ</ThemedText>
        </Pressable>

        <Pressable
          onPress={handleCreatePairedOutfit}
          style={({ pressed }) => [styles.pairedButton, pressed && styles.buttonPressed]}>
          <ThemedText style={styles.pairedButtonText}>Вместе с членом семьи</ThemedText>
        </Pressable>

        {visibleOutfits.length === 0 ? (
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyTitle}>Пока нет сохранённых образов</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.emptySubtitle}>
              Подберите образ для вещи в гардеробе и сохраните понравившийся вариант.
            </ThemedText>
            <Pressable
              onPress={() => router.push('/garderob')}
              style={({ pressed }) => [styles.emptyButton, pressed && styles.buttonPressed]}>
              <ThemedText style={styles.emptyButtonText}>Перейти в гардероб</ThemedText>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: TabScreenScrollPadding },
            ]}
            showsVerticalScrollIndicator={false}>
            {recentWearEvents.length > 0 && (
              <View style={styles.recentWearSection}>
                <ThemedText style={styles.recentWearSectionTitle}>Недавно носили</ThemedText>
                <View style={styles.recentWearList}>
                  {recentWearEvents.map((event) => {
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
            )}

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
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal
        visible={menuOutfit !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOutfitId(null)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOutfitId(null)}>
          <View style={[styles.menuSheet, { top: insets.top + Spacing.five }]}>
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
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
  },
  createButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.light.text,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three + 2,
    borderRadius: 14,
    marginBottom: Spacing.four,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.background,
  },
  pairedButton: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.backgroundSelected,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three + 2,
    borderRadius: 14,
    marginBottom: Spacing.four,
  },
  pairedButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.four,
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
  outfitCard: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    alignSelf: 'stretch',
  },
  outfitCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  outfitTitlePressable: {
    flex: 1,
  },
  outfitTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  outfitDescription: {
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
    width: '100%',
  },
  wearActionRow: {
    gap: Spacing.one,
  },
  wearButton: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: Colors.light.text,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
  },
  wearButtonActive: {
    borderColor: Colors.light.textSecondary,
    backgroundColor: Colors.light.backgroundSelected,
  },
  wearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  wearButtonTextActive: {
    color: Colors.light.textSecondary,
  },
  duplicateHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  recentWearSection: {
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  recentWearSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  recentWearList: {
    gap: Spacing.two,
  },
  recentWearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 14,
    padding: Spacing.two,
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
    backgroundColor: Colors.light.background,
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
    backgroundColor: Colors.light.backgroundSelected,
  },
  recentWearMeta: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  recentWearTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  recentWearDate: {
    fontSize: 13,
    lineHeight: 18,
  },
  menuButton: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 2,
  },
  menuButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    letterSpacing: 1,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  menuSheet: {
    position: 'absolute',
    right: Spacing.four,
    minWidth: 220,
    backgroundColor: Colors.light.background,
    borderRadius: 14,
    paddingVertical: Spacing.one,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  menuOption: {
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
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
