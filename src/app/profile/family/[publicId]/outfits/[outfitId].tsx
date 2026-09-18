import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReadOnlyFamilyOutfitItemsGrid } from '@/components/read-only-family-outfit-items-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useFamilyMemberOutfits } from '@/hooks/use-family-member-outfits';
import { useFamilyMemberWardrobe } from '@/hooks/use-family-member-wardrobe';
import { getOutfitSourceLabel } from '@/utils/build-local-outfit-feed';
import { getFamilyOutfitDescription, resolveFamilyOutfitItems } from '@/utils/family-outfit-items';
import { formatFeedCreatedAt } from '@/utils/wear-date';

export default function FamilyMemberOutfitDetailScreen() {
  const { publicId: publicIdParam, outfitId: outfitIdParam } = useLocalSearchParams<{
    publicId: string;
    outfitId: string;
  }>();
  const publicId = typeof publicIdParam === 'string' ? publicIdParam : '';
  const outfitId = typeof outfitIdParam === 'string' ? outfitIdParam : '';
  const insets = useSafeAreaInsets();
  const { state: outfitsState, refresh: refreshOutfits } = useFamilyMemberOutfits(publicId);
  const { state: wardrobeState, refresh: refreshWardrobe } = useFamilyMemberWardrobe(publicId);

  useFocusEffect(
    useCallback(() => {
      void refreshOutfits();
      void refreshWardrobe();
    }, [refreshOutfits, refreshWardrobe]),
  );

  const outfit = useMemo(() => {
    if (outfitsState.status !== 'ready') {
      return null;
    }

    return outfitsState.outfits.find((entry) => entry.id === outfitId) ?? null;
  }, [outfitId, outfitsState]);

  const wardrobeItems =
    wardrobeState.status === 'ready'
      ? wardrobeState.items
      : wardrobeState.status === 'empty'
        ? []
        : [];

  const outfitItems = useMemo(
    () => (outfit ? resolveFamilyOutfitItems(outfit.itemIds, wardrobeItems) : []),
    [outfit, wardrobeItems],
  );

  const isLoading =
    outfitsState.status === 'loading' ||
    wardrobeState.status === 'loading' ||
    (outfitsState.status === 'ready' && wardrobeState.status !== 'ready' && wardrobeState.status !== 'empty');

  if (!publicId || !outfitId) {
    return null;
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centeredState} edges={['top']}>
          <ActivityIndicator color={Colors.light.text} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!outfit || outfitItems.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.notFoundState}>
            <ThemedText style={styles.notFoundTitle}>Образ не найден</ThemedText>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <ThemedText style={styles.primaryButtonText}>Назад</ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const sourceLabel = getOutfitSourceLabel(outfit.source ?? undefined);
  const createdAtLabel = formatFeedCreatedAt(outfit.createdAt);
  const description = getFamilyOutfitDescription(outfit.description, outfitItems);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, Spacing.four) },
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.headerBack, pressed && styles.pressed]}>
              <SymbolView
                name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
                size={18}
                tintColor={Colors.light.text}
              />
              <ThemedText style={styles.headerBackText}>Образы</ThemedText>
            </Pressable>
          </View>

          <View style={styles.previewCard}>
            <ReadOnlyFamilyOutfitItemsGrid memberPublicId={publicId} items={outfitItems} />
          </View>

          <View style={styles.titleBlock}>
            <ThemedText style={styles.outfitTitle}>{outfit.title}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.metaLine}>
              {sourceLabel} · {createdAtLabel}
            </ThemedText>
          </View>

          {description.length > 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.description}>
              {description}
            </ThemedText>
          ) : null}

          <View style={styles.itemsBlock}>
            {outfitItems.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <ThemedText style={styles.itemName}>{item.name}</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.itemMeta}>
                  {item.category}
                </ThemedText>
              </View>
            ))}
          </View>
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: Spacing.four,
  },
  header: {
    paddingTop: Spacing.two,
  },
  headerBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
  },
  headerBackText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  previewCard: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 18,
    padding: Spacing.three,
  },
  titleBlock: {
    gap: Spacing.one,
  },
  outfitTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.light.text,
  },
  metaLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  itemsBlock: {
    gap: Spacing.two,
  },
  itemRow: {
    gap: Spacing.half,
    paddingVertical: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.light.backgroundSelected,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.text,
  },
  itemMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  notFoundState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: Colors.light.text,
  },
  primaryButton: {
    borderWidth: 1,
    borderColor: Colors.light.backgroundElement,
    borderRadius: 14,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    minHeight: 44,
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  pressed: {
    opacity: 0.85,
  },
});
