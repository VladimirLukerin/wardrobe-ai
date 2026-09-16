import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { OutfitFeedCard } from '@/components/outfit-feed-card';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useOutfits } from '@/contexts/outfits-context';
import { useWardrobe } from '@/contexts/wardrobe-context';
import { buildLocalOutfitFeed } from '@/utils/build-local-outfit-feed';
import { resolveWardrobeItemsFromIds } from '@/utils/resolve-wardrobe-items';

export function HomeOutfitFeed() {
  const { savedOutfits } = useOutfits();
  const { items } = useWardrobe();

  const wardrobeById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const feedEntries = useMemo(() => {
    return buildLocalOutfitFeed(savedOutfits)
      .map((entry) => ({
        ...entry,
        items: resolveWardrobeItemsFromIds(entry.itemIds, wardrobeById),
      }))
      .filter((entry) => entry.items.length > 0);
  }, [savedOutfits, wardrobeById]);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <ThemedText style={styles.sectionTitle}>Что надевают сейчас</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          Пока показываем ваши недавние образы
        </ThemedText>
      </View>

      {feedEntries.length === 0 ? (
        <View style={styles.emptyBlock}>
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            Здесь будут появляться ваши недавние образы
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.emptyHint}>
            Создайте или сохраните первый образ
          </ThemedText>
          <Pressable
            onPress={() => router.push('/create-outfit')}
            style={({ pressed }) => [styles.emptyLink, pressed && styles.buttonPressed]}>
            <ThemedText style={styles.emptyLinkText}>Перейти к образам</ThemedText>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.feedRow}>
          {feedEntries.map((entry) => (
            <OutfitFeedCard
              key={entry.id}
              title={entry.title}
              items={entry.items}
              sourceLabel={entry.sourceLabel}
              createdAt={entry.createdAt}
              onPress={() =>
                router.push({
                  pathname: '/create-outfit/[id]',
                  params: { id: entry.id },
                })
              }
            />
          ))}
        </ScrollView>
      )}
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
  emptyLink: {
    marginTop: Spacing.one,
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
