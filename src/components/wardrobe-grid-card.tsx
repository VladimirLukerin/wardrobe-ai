import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  getWardrobeItemDisplayImageUri,
  getWardrobeItemImageSourceKind,
  getWardrobeItemImageVersion,
} from '@/constants/wardrobe-item';
import { Colors, Spacing } from '@/constants/theme';
import type { WardrobeItem } from '@/contexts/wardrobe-context';
import { shortWardrobeItemId } from '@/utils/short-wardrobe-item-id';

type WardrobeGridCardProps = {
  item: WardrobeItem;
  width: number;
  onPress: () => void;
};

export function WardrobeGridCard({ item, width, onPress }: WardrobeGridCardProps) {
  const displayImageUri = getWardrobeItemDisplayImageUri(item);
  const imageVersion = getWardrobeItemImageVersion(item);
  const sourceKind = getWardrobeItemImageSourceKind(item);

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    console.log(
      `[WARDROBE GRID] item=${shortWardrobeItemId(item.id)} imageVersion=${imageVersion} source=${sourceKind}`,
    );
    console.log(`[WARDROBE GRID] rerender item=${shortWardrobeItemId(item.id)}`);
  }, [imageVersion, item.id, item.isFavorite, item.name, sourceKind]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.cardPressable, { width }, pressed && styles.buttonPressed]}>
      <ThemedView style={styles.card}>
        <Image
          source={{ uri: displayImageUri }}
          recyclingKey={`${item.id}:${imageVersion}`}
          style={styles.cardImage}
          contentFit="cover"
        />
        <ThemedText style={styles.cardLabel}>
          {item.isFavorite ? `♥ ${item.name}` : item.name}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardPressable: {
    borderRadius: 14,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  card: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(32, 35, 29, 0.08)',
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
