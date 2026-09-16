import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { getWardrobeItemDisplayImageUri } from '@/constants/wardrobe-item';
import { Colors, Spacing } from '@/constants/theme';
import { useOutfits } from '@/contexts/outfits-context';
import { useWearHistory } from '@/contexts/wear-history-context';
import type { WardrobeItem } from '@/contexts/wardrobe-context';
import {
  formatLastWornRelative,
  formatWearEventDate,
  getWearRecencyLabel,
} from '@/utils/wear-date';

const RECENT_WEAR_LIMIT = 5;
const DELETED_OUTFIT_TITLE = 'Удалённый образ';

type ItemWearStatisticsSheetProps = {
  visible: boolean;
  item: WardrobeItem;
  onClose: () => void;
};

type MetricCardProps = {
  value: string;
  label: string;
};

function MetricCard({ value, label }: MetricCardProps) {
  return (
    <View style={styles.metricCard}>
      <ThemedText style={styles.metricValue}>{value}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.metricLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <ThemedText style={styles.sectionTitle}>{children}</ThemedText>;
}

export function ItemWearStatisticsSheet({ visible, item, onClose }: ItemWearStatisticsSheetProps) {
  const insets = useSafeAreaInsets();
  const { savedOutfits } = useOutfits();
  const { getItemWearCount, getItemLastWornAt, getItemWearEvents } = useWearHistory();

  const translateY = useSharedValue(0);
  const bottomInset = Math.max(insets.bottom, Spacing.three);

  const wearCount = getItemWearCount(item.id);
  const lastWornAt = getItemLastWornAt(item.id);
  const itemWearEvents = useMemo(
    () => getItemWearEvents(item.id).slice(0, RECENT_WEAR_LIMIT),
    [getItemWearEvents, item.id],
  );

  const savedOutfitsById = useMemo(
    () => new Map(savedOutfits.map((outfit) => [outfit.id, outfit])),
    [savedOutfits],
  );

  const savedOutfitCount = useMemo(
    () => savedOutfits.filter((outfit) => outfit.itemIds.includes(item.id)).length,
    [item.id, savedOutfits],
  );

  const recencyLabel = getWearRecencyLabel(lastWornAt);
  const displayImageUri = getWardrobeItemDisplayImageUri(item);

  const handleDismiss = useCallback(() => {
    translateY.value = 0;
    onClose();
  }, [onClose, translateY]);

  const panGesture = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 72 || event.velocityY > 450) {
        runOnJS(handleDismiss)();
        return;
      }

      translateY.value = withSpring(0);
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    if (!visible) {
      translateY.value = 0;
    }
  }, [visible, translateY]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleDismiss}>
      <GestureHandlerRootView style={styles.overlay}>
        <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
          <GestureDetector gesture={panGesture}>
            <View style={styles.sheetGrabber}>
              <View style={styles.dragArea}>
                <View style={styles.dragHandle} />
              </View>

              <View style={styles.sheetHeader}>
                <ThemedText style={styles.sheetTitle}>Статистика носки</ThemedText>
                <Pressable
                  onPress={handleDismiss}
                  hitSlop={8}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                  <ThemedText style={styles.closeButtonText}>×</ThemedText>
                </Pressable>
              </View>
            </View>
          </GestureDetector>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset }]}
            showsVerticalScrollIndicator={false}>
            <View style={styles.itemHeader}>
              <View style={styles.itemThumbWrap}>
                <Image source={{ uri: displayImageUri }} style={styles.itemThumb} contentFit="contain" />
              </View>
              <ThemedText style={styles.itemName} numberOfLines={2}>
                {item.name}
              </ThemedText>
            </View>

            <ThemedText themeColor="textSecondary" style={styles.recencyLabel}>
              {recencyLabel}
            </ThemedText>

            {wearCount > 0 ? (
              <>
                <View style={styles.metricsRow}>
                  <MetricCard value={String(wearCount)} label="Надевали" />
                  <MetricCard
                    value={lastWornAt ? formatLastWornRelative(lastWornAt) : '—'}
                    label="Последний раз"
                  />
                </View>

                <View style={styles.savedOutfitsRow}>
                  <ThemedText style={styles.savedOutfitsText}>
                    В сохранённых образах: {savedOutfitCount}
                  </ThemedText>
                </View>

                {itemWearEvents.length > 0 && (
                  <View style={styles.section}>
                    <SectionTitle>ПОСЛЕДНИЕ НОСКИ</SectionTitle>
                    <View style={styles.recentWearList}>
                      {itemWearEvents.map((event, index) => {
                        const savedOutfit = savedOutfitsById.get(event.outfitId);
                        const outfitTitle = savedOutfit?.title ?? DELETED_OUTFIT_TITLE;
                        const isLast = index === itemWearEvents.length - 1;

                        return (
                          <View
                            key={event.id}
                            style={[styles.recentWearRow, isLast && styles.recentWearRowLast]}>
                            <ThemedText style={styles.recentWearDate}>
                              {formatWearEventDate(event.wornAt)}
                            </ThemedText>
                            <ThemedText
                              themeColor="textSecondary"
                              style={styles.recentWearOutfit}
                              numberOfLines={2}>
                              {outfitTitle}
                            </ThemedText>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyTitle}>
                  Эту вещь пока не отмечали как надетую
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.emptySubtitle}>
                  Когда вы будете отмечать образы через «Надеть сегодня», здесь появится статистика.
                </ThemedText>
                {savedOutfitCount > 0 && (
                  <ThemedText style={styles.savedOutfitsText}>
                    В сохранённых образах: {savedOutfitCount}
                  </ThemedText>
                )}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
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
    height: '78%',
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.four,
  },
  sheetGrabber: {
    alignSelf: 'stretch',
  },
  dragArea: {
    alignItems: 'center',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.backgroundSelected,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: -Spacing.one,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 28,
    lineHeight: 28,
    color: Colors.light.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: Spacing.three,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  itemThumbWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundElement,
    overflow: 'hidden',
  },
  itemThumb: {
    width: '100%',
    height: '100%',
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  recencyLabel: {
    fontSize: 14,
    lineHeight: 20,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 16,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two + 2,
    alignItems: 'center',
    gap: Spacing.one,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
  },
  metricLabel: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  savedOutfitsRow: {
    paddingVertical: Spacing.one,
  },
  savedOutfitsText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.text,
  },
  section: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: Colors.light.text,
  },
  recentWearList: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 16,
    overflow: 'hidden',
  },
  recentWearRow: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    gap: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.backgroundSelected,
  },
  recentWearRowLast: {
    borderBottomWidth: 0,
  },
  recentWearDate: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  recentWearOutfit: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  emptySubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.85,
  },
});
