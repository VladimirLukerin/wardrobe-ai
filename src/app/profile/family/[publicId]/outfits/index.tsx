import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NetworkErrorCard } from '@/components/network-error-card';
import { ReadOnlyFamilyOutfitCard } from '@/components/read-only-family-outfit-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getFamilyMemberLabel } from '@/constants/family';
import { Colors, MaxContentWidth, Spacing, TabScreenScrollPadding } from '@/constants/theme';
import { useFamilyMemberOutfits } from '@/hooks/use-family-member-outfits';
import { useFamilyMemberWardrobe } from '@/hooks/use-family-member-wardrobe';

export default function FamilyMemberOutfitsScreen() {
  const { publicId: publicIdParam } = useLocalSearchParams<{ publicId: string }>();
  const publicId = typeof publicIdParam === 'string' ? publicIdParam : '';
  const { state, refresh } = useFamilyMemberOutfits(publicId);
  const { state: wardrobeState, refresh: refreshWardrobe } = useFamilyMemberWardrobe(publicId);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void refreshWardrobe();
    }, [refresh, refreshWardrobe]),
  );

  const memberLabel =
    state.status === 'ready' || state.status === 'empty'
      ? getFamilyMemberLabel(state.member)
      : publicId;

  const wardrobeItems =
    wardrobeState.status === 'ready'
      ? wardrobeState.items
      : wardrobeState.status === 'empty'
        ? []
        : [];

  if (!publicId) {
    return null;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText style={styles.backLink}>Назад</ThemedText>
          </Pressable>
        </View>

        <ThemedText type="subtitle" style={styles.title}>
          {memberLabel} — образы
        </ThemedText>

        {state.status === 'loading' ? (
          <View style={styles.centeredState}>
            <ActivityIndicator color={Colors.light.text} />
          </View>
        ) : null}

        {state.status === 'empty' ? (
          <View style={styles.centeredState}>
            <ThemedText style={styles.emptyTitle}>У пользователя пока нет сохранённых образов</ThemedText>
          </View>
        ) : null}

        {state.status === 'ready' ? (
          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}>
            {state.outfits.map((outfit) => (
              <ReadOnlyFamilyOutfitCard
                key={outfit.id}
                memberPublicId={publicId}
                outfit={outfit}
                wardrobeItems={wardrobeItems}
                onPress={() =>
                  router.push({
                    pathname: '/profile/family/[publicId]/outfits/[outfitId]',
                    params: { publicId, outfitId: outfit.id },
                  })
                }
              />
            ))}
          </ScrollView>
        ) : null}

        {state.status === 'error' && state.errorKind === 'network' ? (
          <View style={styles.errorState}>
            <NetworkErrorCard onRetry={() => void refresh()} />
          </View>
        ) : null}

        {state.status === 'error' && state.errorKind !== 'network' ? (
          <View style={styles.centeredState}>
            <ThemedText style={styles.errorTitle}>{state.message}</ThemedText>
            {state.errorKind === 'forbidden' ? (
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                <ThemedText style={styles.backButtonText}>Назад</ThemedText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
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
  header: {
    paddingTop: Spacing.two,
    marginBottom: Spacing.three,
  },
  backLink: {
    fontSize: 16,
    color: Colors.light.text,
  },
  title: {
    marginBottom: Spacing.four,
  },
  listContent: {
    gap: Spacing.three,
    paddingBottom: TabScreenScrollPadding,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: Colors.light.text,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: Colors.light.text,
  },
  backButton: {
    borderWidth: 1,
    borderColor: Colors.light.backgroundElement,
    borderRadius: 14,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    minHeight: 44,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  pressed: {
    opacity: 0.7,
  },
});
