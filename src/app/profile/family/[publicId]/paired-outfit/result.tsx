import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeOutfitPreview } from '@/components/home-outfit-preview';
import { ReadOnlyFamilyOutfitItemsGrid } from '@/components/read-only-family-outfit-items-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getFamilyMemberLabel } from '@/constants/family';
import { Colors, MaxContentWidth, Spacing, TabScreenScrollPadding } from '@/constants/theme';
import { useFamily } from '@/contexts/family-context';
import { useWardrobe } from '@/contexts/wardrobe-context';
import { useFamilyMemberWardrobe } from '@/hooks/use-family-member-wardrobe';
import { AccountApiError } from '@/services/account';
import { savePairedOutfit } from '@/services/paired-outfits-storage';
import { getAuthToken } from '@/storage/auth-token-storage';
import { isRetryableNetworkError } from '@/utils/network-error';
import { peekPairedOutfitResultCache } from '@/utils/paired-outfit-result-cache';
import { resolveWardrobeItemsFromIds } from '@/utils/resolve-wardrobe-items';

export default function PairedOutfitResultScreen() {
  const { publicId: publicIdParam } = useLocalSearchParams<{ publicId: string }>();
  const publicId = typeof publicIdParam === 'string' ? publicIdParam : '';
  const { members } = useFamily();
  const { items } = useWardrobe();
  const { state: familyWardrobeState } = useFamilyMemberWardrobe(publicId);
  const cache = useMemo(() => peekPairedOutfitResultCache(), []);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const member = useMemo(
    () => members.find((entry) => entry.publicId === publicId) ?? null,
    [members, publicId],
  );
  const memberLabel = member ? getFamilyMemberLabel(member) : publicId;
  const wardrobeById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const result = cache?.result ?? null;

  const personAItems = useMemo(() => {
    if (!result) {
      return [];
    }

    return resolveWardrobeItemsFromIds(result.personA.itemIds, wardrobeById);
  }, [result, wardrobeById]);

  const personBItems = useMemo(() => {
    if (!result || familyWardrobeState.status !== 'ready') {
      return [];
    }

    const familyItemsById = new Map(familyWardrobeState.items.map((item) => [item.id, item]));

    return result.personB.itemIds
      .map((itemId) => familyItemsById.get(itemId))
      .filter((item): item is (typeof familyWardrobeState.items)[number] => item !== undefined);
  }, [familyWardrobeState, result]);

  const handleSave = async () => {
    if (!cache || isSaving || isSaved) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const token = await getAuthToken();

      if (!token) {
        setSaveError('Не удалось получить токен авторизации.');
        return;
      }

      await savePairedOutfit(token, {
        memberPublicId: cache.memberPublicId,
        occasion: cache.occasion,
        matchingMode: cache.matchingMode,
        ownerItemIds: cache.result.personA.itemIds,
        memberItemIds: cache.result.personB.itemIds,
        explanation: cache.result.pairExplanation,
      });
      setIsSaved(true);
    } catch (error) {
      if (error instanceof AccountApiError) {
        setSaveError(error.message);
        return;
      }

      if (isRetryableNetworkError(error)) {
        setSaveError('Не удалось сохранить. Проверьте подключение.');
        return;
      }

      setSaveError('Не удалось сохранить совместный образ.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!result || !cache) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centeredState}>
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            Результат подбора недоступен.
          </ThemedText>
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

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Ты</ThemedText>
            {personAItems.length > 0 ? (
              <HomeOutfitPreview items={personAItems} disabled />
            ) : (
              <ThemedText themeColor="textSecondary" style={styles.emptyItemsText}>
                Не удалось загрузить ваши вещи.
              </ThemedText>
            )}
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{memberLabel}</ThemedText>
            {personBItems.length > 0 ? (
              <ReadOnlyFamilyOutfitItemsGrid memberPublicId={publicId} items={personBItems} />
            ) : (
              <ThemedText themeColor="textSecondary" style={styles.emptyItemsText}>
                Не удалось загрузить вещи участника семьи.
              </ThemedText>
            )}
          </View>

          {result.pairExplanation ? (
            <View style={styles.explanationBlock}>
              <ThemedText style={styles.explanationTitle}>Почему это работает</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.explanationText}>
                {result.pairExplanation}
              </ThemedText>
            </View>
          ) : null}

          <Pressable
            onPress={() => {
              void handleSave();
            }}
            disabled={isSaving || isSaved}
            style={({ pressed }) => [
              styles.saveButton,
              (isSaving || isSaved) && styles.saveButtonDisabled,
              pressed && !isSaving && !isSaved && styles.pressed,
            ]}>
            {isSaving ? (
              <ActivityIndicator color={Colors.light.background} />
            ) : (
              <ThemedText style={styles.saveButtonText}>
                {isSaved ? 'Сохранено' : 'Сохранить совместный образ'}
              </ThemedText>
            )}
          </Pressable>

          {saveError ? (
            <ThemedText themeColor="textSecondary" style={styles.saveError}>
              {saveError}
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
  saveButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: Colors.light.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: Colors.light.background,
    fontSize: 16,
    fontWeight: '600',
  },
  saveError: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
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
  backButton: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
