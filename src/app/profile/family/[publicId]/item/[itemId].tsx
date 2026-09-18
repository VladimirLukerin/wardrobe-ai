import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FamilyWardrobeItemImage } from '@/components/family-wardrobe-item-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WearWithChoiceSheet } from '@/components/wear-with-choice-sheet';
import { getFamilyMemberLabel } from '@/constants/family';
import { Colors, MaxContentWidth, Spacing, TabScreenScrollPadding } from '@/constants/theme';
import { useFamilyMemberWardrobe } from '@/hooks/use-family-member-wardrobe';
import { buildPairedOutfitEntryParams } from '@/utils/paired-outfit-route';

export default function FamilyMemberItemDetailScreen() {
  const { publicId: publicIdParam, itemId: itemIdParam } = useLocalSearchParams<{
    publicId: string;
    itemId: string;
  }>();
  const publicId = typeof publicIdParam === 'string' ? publicIdParam : '';
  const itemId = typeof itemIdParam === 'string' ? itemIdParam : '';
  const { state } = useFamilyMemberWardrobe(publicId);
  const [isWearWithChoiceVisible, setIsWearWithChoiceVisible] = useState(false);

  const item = useMemo(() => {
    if (state.status !== 'ready') {
      return null;
    }

    return state.items.find((entry) => entry.id === itemId) ?? null;
  }, [itemId, state]);

  const memberLabel =
    state.status === 'ready' || state.status === 'empty'
      ? getFamilyMemberLabel(state.member)
      : publicId;

  const handleChoosePaired = () => {
    if (!publicId || !itemId) {
      return;
    }

    router.push({
      pathname: '/profile/family/[publicId]/paired-outfit',
      params: buildPairedOutfitEntryParams({
        memberPublicId: publicId,
        fixedItemId: itemId,
        fixedItemOwner: 'member',
      }),
    });
  };

  if (!publicId || !itemId) {
    return null;
  }

  if (state.status === 'loading') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centeredState}>
          <ActivityIndicator color={Colors.light.text} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!item) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centeredState}>
          <ThemedText themeColor="textSecondary">Вещь недоступна.</ThemedText>
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
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}>
            <ThemedText style={styles.backLinkText}>Назад</ThemedText>
          </Pressable>

          <FamilyWardrobeItemImage
            memberPublicId={publicId}
            item={item}
            style={styles.image}
            contentFit="cover"
          />

          <View style={styles.titleBlock}>
            <ThemedText style={styles.itemName}>{item.name}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.itemMeta}>
              {memberLabel} · {item.category} · {item.color}
            </ThemedText>
          </View>

          <Pressable
            onPress={() => setIsWearWithChoiceVisible(true)}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <ThemedText style={styles.primaryButtonText}>С чем носить</ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <WearWithChoiceSheet
        visible={isWearWithChoiceVisible}
        onClose={() => setIsWearWithChoiceVisible(false)}
        pairedOnly
        onChoosePersonal={() => {}}
        onChoosePaired={handleChoosePaired}
      />
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
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: TabScreenScrollPadding,
    gap: Spacing.four,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  backLink: {
    alignSelf: 'flex-start',
    paddingTop: Spacing.two,
  },
  backLinkText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  titleBlock: {
    gap: Spacing.one,
  },
  itemName: {
    fontSize: 28,
    fontWeight: '700',
  },
  itemMeta: {
    fontSize: 16,
    lineHeight: 22,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: Colors.light.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: Colors.light.background,
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: Spacing.two,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
