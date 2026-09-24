import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { WornOutfitFeedCard } from '@/components/worn-outfit-feed-card';
import { PrikinHomeLayout } from '@/constants/prikin-home-tokens';
import { PrikinColors } from '@/constants/prikin-tokens';
import { useHomeWornOutfitFeed } from '@/hooks/use-home-worn-outfit-feed';
import type { WornOutfitFeedDisplayEntry } from '@/services/home-worn-outfit-feed';

function getFeedCardPressHandler(entry: WornOutfitFeedDisplayEntry): (() => void) | undefined {
  if (!entry.canNavigate) {
    return undefined;
  }

  if (entry.source === 'self') {
    return () => {
      router.push({
        pathname: '/create-outfit/[id]',
        params: { id: entry.outfitId },
      });
    };
  }

  if (entry.source === 'family' && entry.memberPublicId) {
    return () => {
      router.push({
        pathname: '/profile/family/[publicId]/outfits/[outfitId]',
        params: {
          publicId: entry.memberPublicId,
          outfitId: entry.outfitId,
        },
      });
    };
  }

  return undefined;
}

export function HomeOutfitFeed() {
  const { entries, status } = useHomeWornOutfitFeed();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Что надевают сейчас</Text>

      {status === 'loading' && entries.length === 0 ? (
        <Text style={styles.bodySecondary}>Загружаем…</Text>
      ) : null}

      {status === 'empty' ? (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyText}>
            Здесь пока тихо. Никто ещё не отметил свой образ. Будь первой — нажми «Надеть сегодня» на
            своём образе.
          </Text>
          <View style={styles.emptyAccentSlot} accessibilityElementsHidden />
        </View>
      ) : null}

      {entries.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.feedRow}>
          {entries.map((entry) => (
            <WornOutfitFeedCard
              key={entry.id}
              entry={entry}
              onPress={getFeedCardPressHandler(entry)}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: PrikinHomeLayout.wornSectionTitleBodyGap,
  },
  sectionTitle: {
    fontSize: PrikinHomeLayout.wornSectionTitleFontSize,
    fontWeight: '700',
    lineHeight: PrikinHomeLayout.sectionCardTitleLineHeight,
    color: PrikinColors.textPrimary,
  },
  bodySecondary: {
    fontSize: PrikinHomeLayout.feelsLikeFontSize,
    lineHeight: PrikinHomeLayout.feelsLikeLineHeight,
    color: PrikinColors.textSecondary,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: PrikinHomeLayout.todayCardRowGap,
  },
  emptyText: {
    flex: 1,
    minWidth: 0,
    maxWidth: `${PrikinHomeLayout.wornEmptyTextMaxWidthRatio * 100}%`,
    fontSize: PrikinHomeLayout.wornSectionBodyFontSize,
    lineHeight: PrikinHomeLayout.cardBodyLineHeight,
    color: PrikinColors.textSecondary,
  },
  emptyAccentSlot: {
    width: PrikinHomeLayout.wornEmptyAccentWidth,
    minHeight: PrikinHomeLayout.wornEmptyAccentWidth,
    flexShrink: 0,
  },
  feedRow: {
    gap: 8,
    paddingRight: 8,
  },
});
