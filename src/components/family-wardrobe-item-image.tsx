import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { resolveFamilyWardrobeItemImageUri } from '@/services/family-wardrobe-image-cache';
import type { FamilyWardrobeItem } from '@/services/family-api';
import { getAuthToken } from '@/storage/auth-token-storage';

type FamilyWardrobeItemImageProps = {
  memberPublicId: string;
  item: FamilyWardrobeItem;
  style?: object;
  contentFit?: 'cover' | 'contain';
};

export function FamilyWardrobeItemImage({
  memberPublicId,
  item,
  style,
  contentFit = 'cover',
}: FamilyWardrobeItemImageProps) {
  const [imageUri, setImageUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const token = await getAuthToken();

      if (!token || cancelled) {
        return;
      }

      const resolvedUri = await resolveFamilyWardrobeItemImageUri(token, memberPublicId, item);

      if (!cancelled) {
        setImageUri(resolvedUri);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    item.id,
    item.images.originalAvailable,
    item.images.processedAvailable,
    item.images.originalUpdatedAt,
    item.images.processedUpdatedAt,
    memberPublicId,
  ]);

  if (!imageUri) {
    return <View style={[styles.placeholder, style]} />;
  }

  return <Image source={{ uri: imageUri }} style={style} contentFit={contentFit} />;
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: Colors.light.backgroundSelected,
  },
});
