import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getWardrobeItemDisplayImageUri } from '@/constants/wardrobe-item';
import { Colors, MaxContentWidth, Spacing, TabScreenScrollPadding } from '@/constants/theme';
import { useOutfits } from '@/contexts/outfits-context';
import { useWearHistory } from '@/contexts/wear-history-context';
import { useWardrobe, type WardrobeItem } from '@/contexts/wardrobe-context';
import {
  buildWardrobeStatistics,
  formatLastWornDaysAgo,
  formatWearCountLabel,
  type WardrobeItemStatEntry,
} from '@/utils/wardrobe-statistics';

function MetricCard({ value, label }: { value: string; label: string }) {
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

function ItemStripCard({
  item,
  subtitle,
  onPress,
}: {
  item: WardrobeItem;
  subtitle?: string;
  onPress: () => void;
}) {
  const displayImageUri = getWardrobeItemDisplayImageUri(item);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.stripCard, pressed && styles.buttonPressed]}>
      <View style={styles.stripThumbWrap}>
        <Image source={{ uri: displayImageUri }} style={styles.stripThumb} contentFit="contain" />
      </View>
      <ThemedText style={styles.stripTitle} numberOfLines={2}>
        {item.name}
      </ThemedText>
      {subtitle ? (
        <ThemedText themeColor="textSecondary" style={styles.stripSubtitle} numberOfLines={1}>
          {subtitle}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

function ItemStrip({
  title,
  entries,
  renderSubtitle,
}: {
  title: string;
  entries: WardrobeItemStatEntry[] | WardrobeItem[];
  renderSubtitle?: (entry: WardrobeItemStatEntry) => string;
}) {
  if (entries.length === 0) {
    return null;
  }

  const isStatEntries = (entry: WardrobeItemStatEntry | WardrobeItem): entry is WardrobeItemStatEntry =>
    'item' in entry;

  return (
    <View style={styles.section}>
      <SectionTitle>{title}</SectionTitle>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripRow}>
        {entries.map((entry) => {
          const item = isStatEntries(entry) ? entry.item : entry;
          const subtitle = isStatEntries(entry) && renderSubtitle ? renderSubtitle(entry) : undefined;

          return (
            <ItemStripCard
              key={item.id}
              item={item}
              subtitle={subtitle}
              onPress={() =>
                router.push({
                  pathname: '/garderob/[id]',
                  params: { id: item.id },
                })
              }
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function WardrobeStatisticsScreen() {
  const { items, isHydrated: isWardrobeHydrated } = useWardrobe();
  const { wearEvents, isHydrated: isWearHistoryHydrated } = useWearHistory();
  const { savedOutfits, isHydrated: isOutfitsHydrated } = useOutfits();

  const isHydrated = isWardrobeHydrated && isWearHistoryHydrated && isOutfitsHydrated;

  const statistics = useMemo(
    () =>
      buildWardrobeStatistics({
        items,
        wearEvents,
        savedOutfits,
      }),
    [items, wearEvents, savedOutfits],
  );

  if (!isHydrated) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centeredState} edges={['top']}>
          <ActivityIndicator color={Colors.light.text} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (statistics.totalItems === 0) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}>
              <SymbolView
                name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
                size={18}
                tintColor={Colors.light.text}
              />
              <ThemedText style={styles.backButtonText}>Гардероб</ThemedText>
            </Pressable>
          </View>

          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyTitle}>Гардероб пока пуст</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.emptySubtitle}>
              Добавьте вещи, чтобы здесь появилась статистика.
            </ThemedText>
            <Pressable
              onPress={() => router.push('/garderob/add-item')}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
              <ThemedText style={styles.primaryButtonText}>Добавить вещь</ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const usagePercent =
    statistics.usageProgress !== null ? Math.round(statistics.usageProgress * 100) : 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}>
            <SymbolView
              name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
              size={18}
              tintColor={Colors.light.text}
            />
            <ThemedText style={styles.backButtonText}>Гардероб</ThemedText>
          </Pressable>
          <ThemedText style={styles.screenTitle}>Статистика</ThemedText>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: TabScreenScrollPadding }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.metricsGrid}>
            <MetricCard value={String(statistics.totalItems)} label="Всего вещей" />
            <MetricCard value={String(statistics.favoriteCount)} label="В избранном" />
            <MetricCard value={String(statistics.wornUniqueCount)} label="Носили" />
            <MetricCard value={String(statistics.savedOutfitCount)} label="Образов" />
          </View>

          {statistics.savedOutfitCount > 0 && (
            <ThemedText themeColor="textSecondary" style={styles.outfitsBreakdown}>
              Ручных: {statistics.manualOutfitCount} · AI: {statistics.aiOutfitCount}
            </ThemedText>
          )}

          {statistics.usageProgress !== null && (
            <View style={styles.usageBlock}>
              <View style={styles.usageHeader}>
                <ThemedText style={styles.usageTitle}>Использовано гардероба</ThemedText>
                <ThemedText style={styles.usageValue}>
                  {statistics.wornUniqueCount} из {statistics.totalItems} вещей
                </ThemedText>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${usagePercent}%` }]} />
              </View>
            </View>
          )}

          <ItemStrip
            title="Чаще всего носите"
            entries={statistics.topWornItems}
            renderSubtitle={(entry) => formatWearCountLabel(entry.wearCount)}
          />

          <ItemStrip
            title="Давно не носили"
            entries={statistics.longUnwornItems}
            renderSubtitle={(entry) =>
              entry.lastWornAt ? formatLastWornDaysAgo(entry.lastWornAt) : ''
            }
          />

          <ItemStrip title="Ещё не надевали" entries={statistics.neverWornItems} />

          <ItemStrip title="Избранное" entries={statistics.favoriteItems} />

          {statistics.categoryCounts.length > 0 && (
            <View style={styles.section}>
              <SectionTitle>Гардероб по категориям</SectionTitle>
              <View style={styles.categoryCard}>
                {statistics.categoryCounts.map((entry, index) => (
                  <View
                    key={entry.group}
                    style={[
                      styles.categoryRow,
                      index < statistics.categoryCounts.length - 1 && styles.categoryRowBorder,
                    ]}>
                    <ThemedText style={styles.categoryLabel}>{entry.label}</ThemedText>
                    <ThemedText style={styles.categoryCount}>{entry.count}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  metricCard: {
    width: '47%',
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
  },
  metricLabel: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  outfitsBreakdown: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: -Spacing.two,
  },
  usageBlock: {
    gap: Spacing.two,
  },
  usageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  usageTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  usageValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.backgroundElement,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.light.text,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  stripRow: {
    gap: Spacing.two,
    paddingRight: Spacing.two,
  },
  stripCard: {
    width: 108,
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 14,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  stripThumbWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: Colors.light.background,
    overflow: 'hidden',
  },
  stripThumb: {
    width: '100%',
    height: '100%',
  },
  stripTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
    lineHeight: 17,
    minHeight: 34,
  },
  stripSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  categoryCard: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 16,
    overflow: 'hidden',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    gap: Spacing.two,
  },
  categoryRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.backgroundSelected,
  },
  categoryLabel: {
    fontSize: 15,
    color: Colors.light.text,
  },
  categoryCount: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  emptyState: {
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
  primaryButton: {
    marginTop: Spacing.two,
    backgroundColor: Colors.light.text,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 14,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.background,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
