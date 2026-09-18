import { Pressable, StyleSheet, View } from 'react-native';

import { FamilyWardrobeItemImage } from '@/components/family-wardrobe-item-image';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import type { FamilyMemberOutfit } from '@/services/family-api';
import type { FamilyWardrobeItem } from '@/services/family-api';
import { getFamilyOutfitDescription, resolveFamilyOutfitItems } from '@/utils/family-outfit-items';

type ReadOnlyFamilyOutfitCardProps = {
  memberPublicId: string;
  outfit: FamilyMemberOutfit;
  wardrobeItems: FamilyWardrobeItem[];
  onPress: () => void;
};

export function ReadOnlyFamilyOutfitCard({
  memberPublicId,
  outfit,
  wardrobeItems,
  onPress,
}: ReadOnlyFamilyOutfitCardProps) {
  const outfitItems = resolveFamilyOutfitItems(outfit.itemIds, wardrobeItems);

  if (outfitItems.length === 0) {
    return null;
  }

  const description = getFamilyOutfitDescription(outfit.description, outfitItems);
  const previewItems = outfitItems.slice(0, 4);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <ThemedText style={styles.title} numberOfLines={2}>
        {outfit.title}
      </ThemedText>

      <View style={styles.previewGrid}>
        {previewItems.map((item) => (
          <View key={item.id} style={styles.previewTile}>
            <FamilyWardrobeItemImage
              memberPublicId={memberPublicId}
              item={item}
              style={styles.previewImage}
              contentFit="contain"
            />
          </View>
        ))}
      </View>

      {description.length > 0 ? (
        <ThemedText themeColor="textSecondary" style={styles.description} numberOfLines={2}>
          {description}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.85,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  previewTile: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: Colors.light.background,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    padding: Spacing.one,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
});
