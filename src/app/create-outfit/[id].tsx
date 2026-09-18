import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

import { OutfitItemsGrid } from '@/components/outfit-items-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useOutfits } from '@/contexts/outfits-context';
import { useWearHistory } from '@/contexts/wear-history-context';
import { useWardrobe } from '@/contexts/wardrobe-context';
import { getOutfitSourceLabel } from '@/utils/build-local-outfit-feed';
import { resolveWardrobeItemsFromIds } from '@/utils/resolve-wardrobe-items';
import { formatFeedCreatedAt, formatLastWornRelative } from '@/utils/wear-date';
import { formatWearCountLabel } from '@/utils/wardrobe-statistics';

const DUPLICATE_HINT_DURATION_MS = 2500;

export default function SavedOutfitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { items, isHydrated: isWardrobeHydrated } = useWardrobe();
  const { savedOutfits, isHydrated: isOutfitsHydrated, removeOutfit } = useOutfits();
  const {
    isHydrated: isWearHistoryHydrated,
    markOutfitWorn,
    isOutfitWornToday,
    getOutfitWearCount,
    getLastWornAt,
  } = useWearHistory();

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [duplicateHintVisible, setDuplicateHintVisible] = useState(false);

  const isHydrated = isWardrobeHydrated && isOutfitsHydrated && isWearHistoryHydrated;

  const outfit = useMemo(
    () => (id ? savedOutfits.find((entry) => entry.id === id) : undefined),
    [id, savedOutfits],
  );

  const wardrobeById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const outfitItems = useMemo(
    () => (outfit ? resolveWardrobeItemsFromIds(outfit.itemIds, wardrobeById) : []),
    [outfit, wardrobeById],
  );

  const wearCount = outfit ? getOutfitWearCount(outfit.id) : 0;
  const lastWornAt = outfit ? getLastWornAt(outfit.id) : null;
  const isWornToday = outfit ? isOutfitWornToday(outfit.id) : false;

  useEffect(() => {
    if (!duplicateHintVisible) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setDuplicateHintVisible(false);
    }, DUPLICATE_HINT_DURATION_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [duplicateHintVisible]);

  const handleWearToday = useCallback(() => {
    if (!outfit) {
      return;
    }

    const result = markOutfitWorn(outfit);

    if (result === 'already_today') {
      setDuplicateHintVisible(true);
    }
  }, [markOutfitWorn, outfit]);

  const handleDelete = useCallback(() => {
    if (!outfit) {
      return;
    }

    setIsMenuVisible(false);

    Alert.alert('Удалить образ?', 'Образ будет удалён из сохранённых.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          removeOutfit(outfit.id);
          router.back();
        },
      },
    ]);
  }, [outfit, removeOutfit]);

  const handleEdit = useCallback(() => {
    Alert.alert('Редактирование скоро появится');
  }, []);

  if (!isHydrated) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centeredState} edges={['top']}>
          <ActivityIndicator color={Colors.light.text} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!outfit) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.notFoundState}>
            <ThemedText style={styles.notFoundTitle}>Образ не найден</ThemedText>
            <Pressable
              onPress={() => router.replace('/create-outfit')}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
              <ThemedText style={styles.primaryButtonText}>Вернуться к образам</ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const sourceLabel = getOutfitSourceLabel(outfit.source);
  const createdAtLabel = formatFeedCreatedAt(outfit.createdAt);
  const description = outfit.description.trim();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, Spacing.four) },
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.headerBack, pressed && styles.buttonPressed]}>
              <SymbolView
                name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
                size={18}
                tintColor={Colors.light.text}
              />
              <ThemedText style={styles.headerBackText}>Образы</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setIsMenuVisible(true)}
              style={({ pressed }) => [styles.menuButton, pressed && styles.buttonPressed]}
              hitSlop={8}>
              <ThemedText style={styles.menuButtonText}>•••</ThemedText>
            </Pressable>
          </View>

          <View style={styles.previewCard}>
            {outfitItems.length > 0 ? (
              <OutfitItemsGrid items={outfitItems} />
            ) : (
              <View style={styles.missingItemsBlock}>
                <ThemedText themeColor="textSecondary" style={styles.missingItemsText}>
                  Вещи из этого образа больше не находятся в гардеробе
                </ThemedText>
              </View>
            )}
          </View>

          <View style={styles.titleBlock}>
            <ThemedText style={styles.outfitTitle}>{outfit.title}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.metaLine}>
              {sourceLabel} · {createdAtLabel}
            </ThemedText>
          </View>

          {description.length > 0 && (
            <ThemedText themeColor="textSecondary" style={styles.description}>
              {description}
            </ThemedText>
          )}

          <View style={styles.wearStatsBlock}>
            <ThemedText themeColor="textSecondary" style={styles.wearStatsLine}>
              Надевали: {formatWearCountLabel(wearCount)}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.wearStatsLine}>
              {lastWornAt
                ? `Последний раз: ${formatLastWornRelative(lastWornAt)}`
                : 'Ещё не надевали'}
            </ThemedText>
          </View>

          <View style={styles.actionsBlock}>
            <Pressable
              onPress={handleWearToday}
              style={({ pressed }) => [
                styles.primaryButton,
                isWornToday && styles.primaryButtonActive,
                pressed && styles.buttonPressed,
              ]}>
              <ThemedText
                style={[styles.primaryButtonText, isWornToday && styles.primaryButtonTextActive]}>
                {isWornToday ? '✓ Надето сегодня' : 'Надеть сегодня'}
              </ThemedText>
            </Pressable>

            {duplicateHintVisible && (
              <ThemedText themeColor="textSecondary" style={styles.duplicateHint}>
                Этот образ уже отмечен как надетый сегодня
              </ThemedText>
            )}

            <View style={styles.secondaryActionsRow}>
              {outfit.source === 'manual' && (
                <Pressable
                  onPress={handleEdit}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}>
                  <ThemedText style={styles.secondaryButtonText}>Редактировать</ThemedText>
                </Pressable>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={isMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMenuVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setIsMenuVisible(false)}>
          <View style={[styles.menuSheet, { top: insets.top + Spacing.five }]}>
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [styles.menuOption, pressed && styles.buttonPressed]}>
              <ThemedText style={styles.menuOptionDelete}>Удалить образ</ThemedText>
            </Pressable>
          </View>
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
  notFoundState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.one,
  },
  headerBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  headerBackText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
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
  previewCard: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 20,
    padding: Spacing.three,
  },
  missingItemsBlock: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  missingItemsText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  titleBlock: {
    gap: Spacing.one,
  },
  outfitTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
    lineHeight: 30,
  },
  metaLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  wearStatsBlock: {
    gap: Spacing.one,
  },
  wearStatsLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionsBlock: {
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  primaryButton: {
    alignSelf: 'stretch',
    borderWidth: 1.5,
    borderColor: Colors.light.text,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonActive: {
    borderColor: Colors.light.textSecondary,
    backgroundColor: Colors.light.backgroundSelected,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  primaryButtonTextActive: {
    color: Colors.light.textSecondary,
  },
  duplicateHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: Colors.light.text,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three + 2,
    borderRadius: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
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
