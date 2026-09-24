import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useOutfits } from '@/contexts/outfits-context';
import { useWearHistory } from '@/contexts/wear-history-context';
import { useWardrobe } from '@/contexts/wardrobe-context';
import { buildWardrobeStatistics } from '@/utils/wardrobe-statistics';

function MetricColumn({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metricColumn}>
      <ThemedText style={styles.metricValue}>{value}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.metricLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

export function HomeWardrobeSummary() {
  const { items } = useWardrobe();
  const { wearEvents } = useWearHistory();
  const { savedOutfits } = useOutfits();

  const statistics = useMemo(
    () =>
      buildWardrobeStatistics({
        items,
        wearEvents,
        savedOutfits,
      }),
    [items, wearEvents, savedOutfits],
  );

  useEffect(() => {
    if (__DEV__ && items.length > 0) {
      console.log(
        `[STATS AUDIT] UI wornItems=${statistics.wornUniqueCount} savedOutfits=${statistics.savedOutfitCount}`,
      );
    }
  }, [items.length, statistics.savedOutfitCount, statistics.wornUniqueCount]);

  if (statistics.totalItems === 0) {
    return (
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Ваш гардероб</ThemedText>
        <View style={styles.card}>
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            Пока здесь пусто
          </ThemedText>
          <Pressable
            onPress={() => router.push('/garderob/add-item')}
            style={({ pressed }) => [styles.emptyLink, pressed && styles.buttonPressed]}>
            <ThemedText style={styles.emptyLinkText}>Добавить вещи</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  const usagePercent =
    statistics.usageProgress !== null ? Math.round(statistics.usageProgress * 100) : 0;

  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>Ваш гардероб</ThemedText>
      <View style={styles.card}>
        <View style={styles.metricsRow}>
          <MetricColumn
            value={`${statistics.wornUniqueCount} из ${statistics.totalItems}`}
            label="Использовано"
          />
          <View style={styles.metricDivider} />
          <MetricColumn value={String(statistics.favoriteCount)} label="В избранном" />
          <View style={styles.metricDivider} />
          <MetricColumn
            value={String(statistics.longUnwornItems.length)}
            label="Давно не носили"
          />
        </View>
        {statistics.usageProgress !== null && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${usagePercent}%` }]} />
          </View>
        )}
      </View>
      <Pressable
        onPress={() => router.push('/garderob/statistics')}
        style={({ pressed }) => [styles.statsLink, pressed && styles.buttonPressed]}>
        <ThemedText style={styles.statsLinkText}>Посмотреть статистику →</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  card: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two + 2,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  metricColumn: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
  },
  metricLabel: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: Colors.light.backgroundSelected,
    marginHorizontal: Spacing.one,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.background,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.light.text,
  },
  statsLink: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  statsLinkText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  emptyLink: {
    alignSelf: 'center',
    paddingVertical: Spacing.one,
  },
  emptyLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
