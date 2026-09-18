import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeOutfitPreview } from '@/components/home-outfit-preview';
import { NetworkErrorCard } from '@/components/network-error-card';
import { ReadOnlyFamilyOutfitItemsGrid } from '@/components/read-only-family-outfit-items-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getFamilyMemberLabel } from '@/constants/family';
import { Colors, MaxContentWidth, Spacing, TabScreenScrollPadding } from '@/constants/theme';
import { useWardrobe } from '@/contexts/wardrobe-context';
import { useFamilyMemberWardrobe } from '@/hooks/use-family-member-wardrobe';
import { AccountApiError } from '@/services/account';
import {
  deleteSavedPairedOutfit,
  fetchSavedPairedOutfit,
  type SavedPairedOutfit,
} from '@/services/paired-outfits-storage';
import { getAuthToken } from '@/storage/auth-token-storage';
import { removeSavedPairedOutfitFromSnapshotCache } from '@/storage/saved-paired-outfits-snapshot-cache';
import { isRetryableNetworkError } from '@/utils/network-error';
import { resolveWardrobeItemsFromIds } from '@/utils/resolve-wardrobe-items';

export default function SavedPairedOutfitDetailScreen() {
  const { id: outfitIdParam } = useLocalSearchParams<{ id: string }>();
  const outfitId = typeof outfitIdParam === 'string' ? outfitIdParam : '';
  const { items } = useWardrobe();
  const [outfit, setOutfit] = useState<SavedPairedOutfit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [deleteNetworkError, setDeleteNetworkError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const memberPublicId = outfit?.member.publicId ?? '';
  const { state: familyWardrobeState } = useFamilyMemberWardrobe(memberPublicId);

  const wardrobeById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const ownerItems = useMemo(() => {
    if (!outfit) {
      return [];
    }

    return resolveWardrobeItemsFromIds(outfit.ownerItemIds, wardrobeById);
  }, [outfit, wardrobeById]);

  const memberItems = useMemo(() => {
    if (!outfit || !outfit.member.accessAvailable || familyWardrobeState.status !== 'ready') {
      return [];
    }

    const familyItemsById = new Map(familyWardrobeState.items.map((item) => [item.id, item]));

    return outfit.memberItemIds
      .map((itemId) => familyItemsById.get(itemId))
      .filter((item): item is (typeof familyWardrobeState.items)[number] => item !== undefined);
  }, [familyWardrobeState, outfit]);

  const memberLabel = outfit
    ? getFamilyMemberLabel({
        publicId: outfit.member.publicId,
        displayName: outfit.member.displayName,
      })
    : '';

  const loadOutfit = useCallback(async () => {
    if (!outfitId) {
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

      const result = await fetchSavedPairedOutfit(token, outfitId);
      setOutfit(result);
    } catch (loadError) {
      if (isRetryableNetworkError(loadError)) {
        setNetworkError(true);
        return;
      }

      if (loadError instanceof AccountApiError) {
        setError(loadError.message);
        return;
      }

      setError('Не удалось загрузить совместный образ.');
    } finally {
      setIsLoading(false);
    }
  }, [outfitId]);

  useEffect(() => {
    void loadOutfit();
  }, [loadOutfit]);

  const finishDelete = useCallback(() => {
    removeSavedPairedOutfitFromSnapshotCache(outfitId);
    router.back();
  }, [outfitId]);

  const performDelete = useCallback(async () => {
    if (isDeleting || !outfitId) {
      return;
    }

    setIsDeleting(true);
    setDeleteNetworkError(false);
    setError(null);

    try {
      const token = await getAuthToken();

      if (!token) {
        setError('Не удалось получить токен авторизации.');
        return;
      }

      await deleteSavedPairedOutfit(token, outfitId);
      finishDelete();
    } catch (deleteError) {
      if (isRetryableNetworkError(deleteError)) {
        setDeleteNetworkError(true);
        return;
      }

      if (deleteError instanceof AccountApiError && deleteError.status === 404) {
        finishDelete();
        return;
      }

      if (deleteError instanceof AccountApiError) {
        setError(deleteError.message);
        return;
      }

      setError('Не удалось удалить совместный образ.');
    } finally {
      setIsDeleting(false);
    }
  }, [finishDelete, isDeleting, outfitId]);

  const handleDeletePress = () => {
    Alert.alert('Удалить совместный образ?', 'Это действие нельзя отменить.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          void performDelete();
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centeredState}>
          <ActivityIndicator color={Colors.light.text} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!outfit) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centeredState}>
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            {error ?? 'Совместный образ не найден.'}
          </ThemedText>
          {networkError ? <NetworkErrorCard compact onRetry={() => void loadOutfit()} /> : null}
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <ThemedText style={styles.backButtonText}>Назад</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText style={styles.backLink}>Назад</ThemedText>
            </Pressable>
          </View>

          <ThemedText style={styles.title}>Совместный образ</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            {outfit.occasion}
          </ThemedText>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Ты</ThemedText>
            {ownerItems.length > 0 ? (
              <HomeOutfitPreview items={ownerItems} disabled />
            ) : (
              <ThemedText themeColor="textSecondary" style={styles.emptyItemsText}>
                Не удалось загрузить ваши вещи.
              </ThemedText>
            )}
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{memberLabel}</ThemedText>
            {!outfit.member.accessAvailable ? (
              <ThemedText themeColor="textSecondary" style={styles.unavailableText}>
                Доступ к части образа больше недоступен. Пользователь больше не в вашей семье.
              </ThemedText>
            ) : memberItems.length > 0 ? (
              <ReadOnlyFamilyOutfitItemsGrid memberPublicId={memberPublicId} items={memberItems} />
            ) : (
              <ThemedText themeColor="textSecondary" style={styles.emptyItemsText}>
                Не удалось загрузить вещи участника семьи.
              </ThemedText>
            )}
          </View>

          {outfit.explanation ? (
            <View style={styles.explanationBlock}>
              <ThemedText style={styles.explanationTitle}>Почему это работает</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.explanationText}>
                {outfit.explanation}
              </ThemedText>
            </View>
          ) : null}

          <Pressable
            onPress={handleDeletePress}
            disabled={isDeleting}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && !isDeleting && styles.pressed,
              isDeleting && styles.deleteButtonDisabled,
            ]}>
            {isDeleting ? (
              <ActivityIndicator color="#DC2626" />
            ) : (
              <ThemedText style={styles.deleteButtonText}>Удалить совместный образ</ThemedText>
            )}
          </Pressable>

          {deleteNetworkError ? (
            <NetworkErrorCard compact onRetry={() => void performDelete()} />
          ) : null}
          {error ? (
            <ThemedText themeColor="textSecondary" style={styles.errorText}>
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
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  scrollContent: {
    paddingBottom: TabScreenScrollPadding,
    gap: Spacing.four,
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
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  explanationBlock: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.light.backgroundSelected,
  },
  explanationTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  explanationText: {
    fontSize: 15,
    lineHeight: 22,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  emptyItemsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  unavailableText: {
    fontSize: 14,
    lineHeight: 20,
  },
  backButton: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    marginTop: Spacing.two,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
  },
  deleteButtonDisabled: {
    opacity: 0.7,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#DC2626',
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
