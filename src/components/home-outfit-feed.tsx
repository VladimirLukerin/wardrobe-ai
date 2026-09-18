import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WornOutfitFeedCard } from '@/components/worn-outfit-feed-card';
import { Colors, Spacing } from '@/constants/theme';
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
      <View style={styles.header}>
        <ThemedText style={styles.sectionTitle}>Что надевают сейчас</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          Недавние образы вашей семьи
        </ThemedText>
      </View>

      {status === 'loading' && entries.length === 0 ? (
        <View style={styles.loadingBlock}>
          <ThemedText themeColor="textSecondary" style={styles.loadingText}>
            Загружаем недавние образы...
          </ThemedText>
        </View>
      ) : null}

      {status === 'empty' ? (
        <View style={styles.emptyBlock}>
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            Пока никто не отметил образ как надетый
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.emptyHint}>
            Отметьте образ кнопкой «Надеть сегодня»
          </ThemedText>
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
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.one,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  feedRow: {
    gap: Spacing.two,
    paddingRight: Spacing.two,
  },
  loadingBlock: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 16,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  emptyBlock: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 16,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    gap: Spacing.one,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
