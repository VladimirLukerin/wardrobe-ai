import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NetworkErrorCard } from '@/components/network-error-card';
import { ReadOnlyWardrobeGrid } from '@/components/read-only-wardrobe-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getFamilyMemberLabel } from '@/constants/family';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useFamilyMemberWardrobe } from '@/hooks/use-family-member-wardrobe';

export default function FamilyMemberWardrobeScreen() {
  const { publicId: publicIdParam } = useLocalSearchParams<{ publicId: string }>();
  const publicId = typeof publicIdParam === 'string' ? publicIdParam : '';
  const { state, refresh } = useFamilyMemberWardrobe(publicId);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const memberLabel =
    state.status === 'ready' || state.status === 'empty'
      ? getFamilyMemberLabel(state.member)
      : publicId;

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
          {memberLabel} — гардероб
        </ThemedText>

        {state.status === 'loading' ? (
          <View style={styles.centeredState}>
            <ActivityIndicator color={Colors.light.text} />
          </View>
        ) : null}

        {state.status === 'empty' ? (
          <View style={styles.centeredState}>
            <ThemedText style={styles.emptyTitle}>В гардеробе пока нет вещей</ThemedText>
          </View>
        ) : null}

        {state.status === 'ready' ? (
          <ReadOnlyWardrobeGrid
            memberPublicId={publicId}
            items={state.items}
            onItemPress={(item) => {
              router.push({
                pathname: '/profile/family/[publicId]/item/[itemId]',
                params: { publicId, itemId: item.id },
              });
            }}
          />
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
