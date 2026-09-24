import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FamilyWardrobeItemImage } from '@/components/family-wardrobe-item-image';
import { ThemedText } from '@/components/themed-text';
import { getWardrobeItemDisplayImageUri } from '@/constants/wardrobe-item';
import { Colors, Spacing } from '@/constants/theme';
import type { WardrobeItem } from '@/contexts/wardrobe-context';
import type { FamilyWardrobeItem } from '@/services/family-api';
import type { WornOutfitFeedDisplayEntry } from '@/services/home-worn-outfit-feed';
import { formatFeedCreatedAt } from '@/utils/wear-date';

const GRID_GAP = 8;

type WornOutfitFeedCardProps = {
  entry: WornOutfitFeedDisplayEntry;
  onPress?: () => void;
  width?: number;
};

function SelfItemTile({ item }: { item: WardrobeItem }) {
  const displayImageUri = getWardrobeItemDisplayImageUri(item);

  return (
    <View style={styles.itemTile}>
      <Image source={{ uri: displayImageUri }} style={styles.itemImage} contentFit="contain" />
    </View>
  );
}

function FamilyItemTile({
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
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <View style={styles.itemsRow}>
      <View style={[styles.itemColumn, { marginRight: GRID_GAP }]}>{left}</View>
      <View style={styles.itemColumn}>{right}</View>
    </View>
  );
}

function renderItemTiles(entry: WornOutfitFeedDisplayEntry): React.ReactNode {
  const visibleItems = entry.items.slice(0, 4);

  if (visibleItems.length === 0) {
    return null;
  }

  const renderTile = (item: WardrobeItem | FamilyWardrobeItem, index: number) => {
    if (entry.source === 'self') {
      return <SelfItemTile key={`${entry.id}-${index}`} item={item as WardrobeItem} />;
    }

    return (
      <FamilyItemTile
        key={`${entry.id}-${index}`}
        memberPublicId={entry.memberPublicId}
        item={item as FamilyWardrobeItem}
      />
    );
  };

  if (visibleItems.length === 1) {
    return (
      <View style={styles.itemsGrid}>
        <View style={styles.singleItemRow}>
          <View style={styles.itemColumnSingle}>{renderTile(visibleItems[0], 0)}</View>
        </View>
      </View>
    );
  }

  if (visibleItems.length === 2) {
    return (
      <View style={styles.itemsGrid}>
        <TwoItemRow left={renderTile(visibleItems[0], 0)} right={renderTile(visibleItems[1], 1)} />
      </View>
    );
  }

  if (visibleItems.length === 3) {
    return (
      <View style={styles.itemsGrid}>
        <View style={[styles.gridStack, { gap: GRID_GAP }]}>
          <TwoItemRow left={renderTile(visibleItems[0], 0)} right={renderTile(visibleItems[1], 1)} />
          <View style={styles.singleItemRow}>
            <View style={styles.itemColumnSingle}>{renderTile(visibleItems[2], 2)}</View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.itemsGrid}>
      <View style={[styles.gridStack, { gap: GRID_GAP }]}>
        <TwoItemRow left={renderTile(visibleItems[0], 0)} right={renderTile(visibleItems[1], 1)} />
        <TwoItemRow left={renderTile(visibleItems[2], 2)} right={renderTile(visibleItems[3], 3)} />
      </View>
    </View>
  );
}

export function WornOutfitFeedCard({
  entry,
  onPress,
  width = 260,
}: WornOutfitFeedCardProps) {
  const itemTiles = useMemo(() => renderItemTiles(entry), [entry]);

  if (!itemTiles) {
    return null;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        { width },
        onPress && pressed && styles.buttonPressed,
      ]}>
      <ThemedText style={styles.title} numberOfLines={2}>
        {entry.title}
      </ThemedText>
      {itemTiles}
      <View style={styles.metaRow}>
        <ThemedText themeColor="textSecondary" style={styles.wearerLabel} numberOfLines={1}>
          {entry.wearer.displayName}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.wornAt}>
          {formatFeedCreatedAt(entry.wornAt)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    lineHeight: 20,
    minHeight: 40,
  },
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
    borderRadius: 12,
    backgroundColor: Colors.light.background,
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
    padding: Spacing.one,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  wearerLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  wornAt: {
    fontSize: 12,
    lineHeight: 16,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
