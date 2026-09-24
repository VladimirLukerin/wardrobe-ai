import { StyleSheet, View } from 'react-native';

import { FamilyWardrobeItemImage } from '@/components/family-wardrobe-item-image';
import { Colors, Spacing } from '@/constants/theme';
import type { FamilyWardrobeItem } from '@/services/family-api';

const GRID_GAP = 12;

type ReadOnlyFamilyOutfitItemsGridProps = {
  memberPublicId: string;
  items: FamilyWardrobeItem[];
};

function OutfitItemTile({
  memberPublicId,
  item,
}: {
  memberPublicId: string;
  item: FamilyWardrobeItem;
}) {
  return (
    <View style={styles.itemTile}>
      <FamilyWardrobeItemImage
        memberPublicId={memberPublicId}
        item={item}
        style={styles.itemImage}
        contentFit="contain"
      />
    </View>
  );
}

function TwoItemRow({
  memberPublicId,
  left,
  right,
}: {
  memberPublicId: string;
  left: FamilyWardrobeItem;
  right: FamilyWardrobeItem;
}) {
  return (
    <View style={styles.itemsRow}>
      <View style={[styles.itemColumn, styles.itemColumnLeft]}>
        <OutfitItemTile memberPublicId={memberPublicId} item={left} />
      </View>
      <View style={styles.itemColumn}>
        <OutfitItemTile memberPublicId={memberPublicId} item={right} />
      </View>
    </View>
  );
}

export function ReadOnlyFamilyOutfitItemsGrid({
  memberPublicId,
  items,
}: ReadOnlyFamilyOutfitItemsGridProps) {
  const visibleItems = items.slice(0, 6);
  const count = visibleItems.length;

  if (count === 0) {
    return null;
  }

  if (count === 1) {
    return (
      <View style={styles.itemsGrid}>
        <View style={styles.singleItemRow}>
          <View style={styles.itemColumnSingle}>
            <OutfitItemTile memberPublicId={memberPublicId} item={visibleItems[0]} />
          </View>
        </View>
      </View>
    );
  }

  if (count === 2) {
    return (
      <View style={styles.itemsGrid}>
        <TwoItemRow memberPublicId={memberPublicId} left={visibleItems[0]} right={visibleItems[1]} />
      </View>
    );
  }

  if (count === 3) {
    return (
      <View style={styles.itemsGrid}>
        <View style={styles.gridStack}>
          <TwoItemRow memberPublicId={memberPublicId} left={visibleItems[0]} right={visibleItems[1]} />
          <View style={styles.singleItemRow}>
            <View style={styles.itemColumnSingle}>
              <OutfitItemTile memberPublicId={memberPublicId} item={visibleItems[2]} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (count === 4) {
    return (
      <View style={styles.itemsGrid}>
        <View style={styles.gridStack}>
          <TwoItemRow memberPublicId={memberPublicId} left={visibleItems[0]} right={visibleItems[1]} />
          <TwoItemRow memberPublicId={memberPublicId} left={visibleItems[2]} right={visibleItems[3]} />
        </View>
      </View>
    );
  }

  if (count === 5) {
    return (
      <View style={styles.itemsGrid}>
        <View style={styles.gridStack}>
          <TwoItemRow memberPublicId={memberPublicId} left={visibleItems[0]} right={visibleItems[1]} />
          <TwoItemRow memberPublicId={memberPublicId} left={visibleItems[2]} right={visibleItems[3]} />
          <View style={styles.singleItemRow}>
            <View style={styles.itemColumnSingle}>
              <OutfitItemTile memberPublicId={memberPublicId} item={visibleItems[4]} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.itemsGrid}>
      <View style={styles.gridStack}>
        <TwoItemRow memberPublicId={memberPublicId} left={visibleItems[0]} right={visibleItems[1]} />
        <TwoItemRow memberPublicId={memberPublicId} left={visibleItems[2]} right={visibleItems[3]} />
        <TwoItemRow memberPublicId={memberPublicId} left={visibleItems[4]} right={visibleItems[5]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  itemsGrid: {
    width: '100%',
  },
  itemsRow: {
    flexDirection: 'row',
    width: '100%',
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
  itemColumnLeft: {
    marginRight: GRID_GAP,
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
  },
  itemImage: {
    width: '100%',
    height: '100%',
    padding: Spacing.one,
  },
});
