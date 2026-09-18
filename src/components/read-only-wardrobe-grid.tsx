import { useCallback } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';

import { FamilyWardrobeItemImage } from '@/components/family-wardrobe-item-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import type { FamilyWardrobeItem } from '@/services/family-api';

const GRID_GAP = Spacing.two;
const NUM_COLUMNS = 2;

type ReadOnlyWardrobeGridProps = {
  memberPublicId: string;
  items: FamilyWardrobeItem[];
};

export function ReadOnlyWardrobeGrid({ memberPublicId, items }: ReadOnlyWardrobeGridProps) {
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = Math.min(windowWidth, MaxContentWidth);
  const cardWidth = (contentWidth - Spacing.four * 2 - GRID_GAP) / NUM_COLUMNS;

  const renderItem = useCallback(
    ({ item }: { item: FamilyWardrobeItem }) => (
      <View style={[styles.cardContainer, { width: cardWidth }]}>
        <ThemedView style={styles.card}>
          <FamilyWardrobeItemImage
            memberPublicId={memberPublicId}
            item={item}
            style={styles.cardImage}
            contentFit="cover"
          />
          <ThemedText style={styles.cardLabel}>{item.name}</ThemedText>
        </ThemedView>
      </View>
    ),
    [cardWidth, memberPublicId],
  );

  return (
    <FlatList
      style={styles.list}
      data={items}
      keyExtractor={(item) => item.id}
      numColumns={NUM_COLUMNS}
      renderItem={renderItem}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  grid: {
    paddingBottom: Spacing.four,
  },
  row: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  cardContainer: {
    borderRadius: 14,
  },
  card: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
