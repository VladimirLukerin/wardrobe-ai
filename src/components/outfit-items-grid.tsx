import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { getWardrobeItemDisplayImageUri } from '@/constants/wardrobe-item';
import { Colors, Spacing } from '@/constants/theme';
import type { WardrobeItem } from '@/contexts/wardrobe-context';

const GRID_GAP = 12;
const GRID_GAP_COMPACT = 8;

type OutfitItemTileProps = {
  item: WardrobeItem;
  highlightItemId?: string;
  compact?: boolean;
};

function OutfitItemTile({ item, highlightItemId, compact }: OutfitItemTileProps) {
  const displayImageUri = getWardrobeItemDisplayImageUri(item);
  const isHighlighted = highlightItemId === item.id;

  return (
    <View style={[styles.itemTile, compact && styles.itemTileCompact]}>
      <Image source={{ uri: displayImageUri }} style={styles.itemImage} contentFit="contain" />
      {isHighlighted && (
        <View style={styles.primaryBadge}>
          <ThemedText style={styles.primaryBadgeText}>Основная вещь</ThemedText>
        </View>
      )}
    </View>
  );
}

type TwoItemRowProps = {
  left: WardrobeItem;
  right: WardrobeItem;
  highlightItemId?: string;
  compact?: boolean;
  gap: number;
};

function TwoItemRow({ left, right, highlightItemId, compact, gap }: TwoItemRowProps) {
  return (
    <View style={styles.itemsRow}>
      <View style={[styles.itemColumn, { marginRight: gap }]}>
        <OutfitItemTile item={left} highlightItemId={highlightItemId} compact={compact} />
      </View>
      <View style={styles.itemColumn}>
        <OutfitItemTile item={right} highlightItemId={highlightItemId} compact={compact} />
      </View>
    </View>
  );
}

type OutfitItemsGridProps = {
  items: WardrobeItem[];
  highlightItemId?: string;
  maxVisibleItems?: number;
  compact?: boolean;
};

export function OutfitItemsGrid({
  items,
  highlightItemId,
  maxVisibleItems = 4,
  compact = false,
}: OutfitItemsGridProps) {
  const gap = compact ? GRID_GAP_COMPACT : GRID_GAP;
  const visibleItems = items.slice(0, maxVisibleItems);
  const count = visibleItems.length;

  if (count === 0) {
    return null;
  }

  if (count === 1) {
    return (
      <View style={styles.itemsGrid}>
        <View style={styles.singleItemRow}>
          <View style={styles.itemColumnSingle}>
            <OutfitItemTile item={visibleItems[0]} highlightItemId={highlightItemId} compact={compact} />
          </View>
        </View>
      </View>
    );
  }

  if (count === 2) {
    return (
      <View style={styles.itemsGrid}>
        <TwoItemRow
          left={visibleItems[0]}
          right={visibleItems[1]}
          highlightItemId={highlightItemId}
          compact={compact}
          gap={gap}
        />
      </View>
    );
  }

  if (count === 3) {
    return (
      <View style={styles.itemsGrid}>
        <View style={[styles.gridStack, { gap }]}>
          <TwoItemRow
            left={visibleItems[0]}
            right={visibleItems[1]}
            highlightItemId={highlightItemId}
            compact={compact}
            gap={gap}
          />
          <View style={styles.singleItemRow}>
            <View style={styles.itemColumnSingle}>
              <OutfitItemTile item={visibleItems[2]} highlightItemId={highlightItemId} compact={compact} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (count === 4) {
    return (
      <View style={styles.itemsGrid}>
        <View style={[styles.gridStack, { gap }]}>
          <TwoItemRow
            left={visibleItems[0]}
            right={visibleItems[1]}
            highlightItemId={highlightItemId}
            compact={compact}
            gap={gap}
          />
          <TwoItemRow
            left={visibleItems[2]}
            right={visibleItems[3]}
            highlightItemId={highlightItemId}
            compact={compact}
            gap={gap}
          />
        </View>
      </View>
    );
  }

  if (count === 5) {
    return (
      <View style={styles.itemsGrid}>
        <View style={[styles.gridStack, { gap }]}>
          <TwoItemRow
            left={visibleItems[0]}
            right={visibleItems[1]}
            highlightItemId={highlightItemId}
            compact={compact}
            gap={gap}
          />
          <TwoItemRow
            left={visibleItems[2]}
            right={visibleItems[3]}
            highlightItemId={highlightItemId}
            compact={compact}
            gap={gap}
          />
          <View style={styles.singleItemRow}>
            <View style={styles.itemColumnSingle}>
              <OutfitItemTile item={visibleItems[4]} highlightItemId={highlightItemId} compact={compact} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.itemsGrid}>
      <View style={[styles.gridStack, { gap }]}>
        <TwoItemRow
          left={visibleItems[0]}
          right={visibleItems[1]}
          highlightItemId={highlightItemId}
          compact={compact}
          gap={gap}
        />
        <TwoItemRow
          left={visibleItems[2]}
          right={visibleItems[3]}
          highlightItemId={highlightItemId}
          compact={compact}
          gap={gap}
        />
        <TwoItemRow
          left={visibleItems[4]}
          right={visibleItems[5]}
          highlightItemId={highlightItemId}
          compact={compact}
          gap={gap}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  itemsGrid: {
    width: '100%',
    alignSelf: 'stretch',
  },
  itemsRow: {
    flexDirection: 'row',
    width: '100%',
    alignSelf: 'stretch',
  },
  gridStack: {
    width: '100%',
    gap: GRID_GAP,
  },
  singleItemRow: {
    width: '100%',
    alignItems: 'center',
  },
  itemColumn: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  itemColumnSingle: {
    width: '50%',
    minWidth: 0,
  },
  itemTile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: Colors.light.background,
    overflow: 'hidden',
    position: 'relative',
  },
  itemTileCompact: {
    maxHeight: 88,
    borderRadius: 12,
  },
  itemImage: {
    width: '100%',
    height: '100%',
    padding: Spacing.one,
  },
  primaryBadge: {
    position: 'absolute',
    top: Spacing.one,
    left: Spacing.one,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 12,
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.backgroundSelected,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
});
