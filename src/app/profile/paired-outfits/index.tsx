import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { NetworkErrorCard } from '@/components/network-error-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getFamilyMemberLabel } from '@/constants/family';
import { Colors, MaxContentWidth, Spacing, TabScreenScrollPadding } from '@/constants/theme';
import { useAccount } from '@/contexts/account-context';
import { useWardrobe } from '@/contexts/wardrobe-context';
import { getWardrobeItemDisplayImageUri } from '@/constants/wardrobe-item';
import { AccountApiError } from '@/services/account';
import { fetchSavedPairedOutfits, type SavedPairedOutfit } from '@/services/paired-outfits-storage';
import { getAuthToken } from '@/storage/auth-token-storage';
import {
  getSavedPairedOutfitsSnapshotCache,
  setSavedPairedOutfitsSnapshotCache,
} from '@/storage/saved-paired-outfits-snapshot-cache';
import { isRetryableNetworkError } from '@/utils/network-error';
import { resolveWardrobeItemsFromIds } from '@/utils/resolve-wardrobe-items';
import { formatFeedCreatedAt } from '@/utils/wear-date';

function OwnerPreview({ itemIds }: { itemIds: string[] }) {
  const { items } = useWardrobe();
  const wardrobeById = new Map(items.map((item) => [item.id, item]));
  const previewItems = resolveWardrobeItemsFromIds(itemIds, wardrobeById).slice(0, 2);

  if (previewItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.previewRow}>
      {previewItems.map((item) => (
        <View key={item.id} style={styles.previewTile}>
          <Image
            source={{ uri: getWardrobeItemDisplayImageUri(item) }}
            style={styles.previewImage}
            contentFit="contain"
          />
        </View>
      ))}
    </View>
  );
}

function SavedPairedOutfitCard({ outfit }: { outfit: SavedPairedOutfit }) {
  const memberLabel = getFamilyMemberLabel({
    publicId: outfit.member.publicId,
    displayName: outfit.member.displayName,
  });

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/profile/paired-outfits/[id]',
          params: { id: outfit.id },
        })
      }
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.cardTitle}>{memberLabel}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.cardDate}>
          {formatFeedCreatedAt(outfit.createdAt)}
        </ThemedText>
      </View>
      <ThemedText themeColor="textSecondary" style={styles.cardOccasion}>
        {outfit.occasion}
      </ThemedText>
      <View style={styles.previewGroups}>
        <OwnerPreview itemIds={outfit.ownerItemIds} />
        <ThemedText themeColor="textSecondary" style={styles.memberPreviewHint}>
          {outfit.member.accessAvailable
            ? `${outfit.memberItemIds.length} вещей партнёра`
            : 'Часть образа недоступна'}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export default function SavedPairedOutfitsScreen() {
  const { isServerAccount } = useAccount();
  const [outfits, setOutfits] = useState<SavedPairedOutfit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOutfits = useCallback(async () => {
    if (!isServerAccount) {
      setOutfits([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setNetworkError(false);
    setError(null);

    try {
      const token = await getAuthToken();

      if (!token) {
        setError('Не удалось получить токен авторизации.');
        return;
      }

      const result = await fetchSavedPairedOutfits(token);
      setSavedPairedOutfitsSnapshotCache(result);
      setOutfits(result);
    } catch (loadError) {
      if (isRetryableNetworkError(loadError)) {
        setNetworkError(true);
        return;
      }

      if (loadError instanceof AccountApiError) {
        setError(loadError.message);
        return;
      }

      setError('Не удалось загрузить совместные образы.');
    } finally {
      setIsLoading(false);
    }
  }, [isServerAccount]);

  useEffect(() => {
    void loadOutfits();
  }, [loadOutfits]);

  useFocusEffect(
    useCallback(() => {
      const cached = getSavedPairedOutfitsSnapshotCache();

      if (cached) {
        setOutfits(cached);
      }
    }, []),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText style={styles.backLink}>Назад</ThemedText>
            </Pressable>
          </View>

          <ThemedText style={styles.title}>Совместные образы</ThemedText>

          {isLoading ? (
            <ActivityIndicator color={Colors.light.text} />
          ) : outfits.length === 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              Пока нет сохранённых совместных образов.
            </ThemedText>
          ) : (
            outfits.map((outfit) => <SavedPairedOutfitCard key={outfit.id} outfit={outfit} />)
          )}

          {networkError ? <NetworkErrorCard compact onRetry={() => void loadOutfits()} /> : null}
          {error ? (
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  scrollContent: {
    paddingBottom: TabScreenScrollPadding,
    gap: Spacing.three,
  },
  header: {
    paddingTop: Spacing.two,
  },
  backLink: {
    fontSize: 16,
    color: Colors.light.text,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.backgroundSelected,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  cardDate: {
    fontSize: 13,
  },
  cardOccasion: {
    fontSize: 14,
    lineHeight: 20,
  },
  previewGroups: {
    gap: Spacing.two,
  },
  previewRow: {
    flexDirection: 'row',
    gap: 12,
  },
  previewTile: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundElement,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    padding: 6,
  },
  memberPreviewHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  unavailableText: {
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.7,
  },
});
