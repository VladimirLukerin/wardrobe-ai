import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { NetworkErrorCard } from '@/components/network-error-card';
import { OutfitFeedbackDislikeSheet } from '@/components/outfit-feedback-dislike-sheet';
import { OutfitFeedbackItemPickerSheet } from '@/components/outfit-feedback-item-picker-sheet';
import { ThemedText } from '@/components/themed-text';
import type { OutfitFeedback, OutfitFeedbackReason } from '@/constants/outfit-feedback';
import { Colors, Spacing } from '@/constants/theme';
import type { WardrobeItem } from '@/contexts/wardrobe-context';

type Props = {
  enabled: boolean;
  feedback: OutfitFeedback | null;
  outfitItems: WardrobeItem[];
  isLoading: boolean;
  isSubmitting: boolean;
  loadError: boolean;
  submitError: boolean;
  onLike: () => void;
  onDislike: (reason: OutfitFeedbackReason | null, targetItemId?: string) => void;
  onRetryLoad: () => void;
  onRetrySubmit: () => void;
};

export function HomeOutfitFeedback({
  enabled,
  feedback,
  outfitItems,
  isLoading,
  isSubmitting,
  loadError,
  submitError,
  onLike,
  onDislike,
  onRetryLoad,
  onRetrySubmit,
}: Props) {
  const [isDislikeSheetVisible, setDislikeSheetVisible] = useState(false);
  const [isItemPickerVisible, setItemPickerVisible] = useState(false);
  const dislikeSubmittedRef = useRef(false);

  const closeDislikeSheet = () => {
    setDislikeSheetVisible(false);
    dislikeSubmittedRef.current = false;
  };

  const closeItemPicker = () => {
    setItemPickerVisible(false);
  };

  const handleOpenDislikeSheet = () => {
    dislikeSubmittedRef.current = false;
    setDislikeSheetVisible(true);
  };

  const handleDislikeSubmit = (reason: OutfitFeedbackReason | null) => {
    if (reason === 'item_disliked') {
      setDislikeSheetVisible(false);
      setItemPickerVisible(true);
      return;
    }

    if (dislikeSubmittedRef.current) {
      return;
    }

    dislikeSubmittedRef.current = true;
    onDislike(reason);
    closeDislikeSheet();
  };

  const handleDislikeSheetClose = () => {
    if (!dislikeSubmittedRef.current) {
      handleDislikeSubmit(null);
      return;
    }

    closeDislikeSheet();
  };

  const handleItemSelect = (itemId: string) => {
    if (dislikeSubmittedRef.current) {
      return;
    }

    dislikeSubmittedRef.current = true;
    onDislike('item_disliked', itemId);
    closeItemPicker();
  };

  if (!enabled) {
    return null;
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={Colors.light.textSecondary} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.container}>
        <NetworkErrorCard compact onRetry={onRetryLoad} />
      </View>
    );
  }

  if (feedback) {
    return (
      <View style={styles.container}>
        <ThemedText themeColor="textSecondary" style={styles.acknowledged}>
          Учтём это в следующих образах
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ThemedText style={styles.prompt}>Как вам этот образ?</ThemedText>
      <View style={styles.actions}>
        <Pressable
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Нравится"
          onPress={onLike}
          style={({ pressed }) => [
            styles.actionButton,
            styles.likeButton,
            pressed && !isSubmitting && styles.pressed,
            isSubmitting && styles.disabled,
          ]}>
          {isSubmitting ? (
            <ActivityIndicator size="small" color={Colors.light.text} />
          ) : (
            <ThemedText style={styles.actionText}>Нравится</ThemedText>
          )}
        </Pressable>
        <Pressable
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Не нравится"
          onPress={handleOpenDislikeSheet}
          style={({ pressed }) => [
            styles.actionButton,
            styles.dislikeButton,
            pressed && !isSubmitting && styles.pressed,
            isSubmitting && styles.disabled,
          ]}>
          <ThemedText style={styles.actionText}>Не нравится</ThemedText>
        </Pressable>
      </View>
      {submitError ? (
        <NetworkErrorCard compact onRetry={onRetrySubmit} />
      ) : null}
      <OutfitFeedbackDislikeSheet
        visible={isDislikeSheetVisible}
        isSubmitting={isSubmitting}
        onClose={handleDislikeSheetClose}
        onSelectReason={handleDislikeSubmit}
      />
      <OutfitFeedbackItemPickerSheet
        visible={isItemPickerVisible}
        items={outfitItems}
        isSubmitting={isSubmitting}
        onClose={closeItemPicker}
        onSelectItem={handleItemSelect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.two,
    gap: Spacing.one,
  },
  prompt: {
    fontSize: 15,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderRadius: 12,
    paddingHorizontal: Spacing.two,
  },
  likeButton: {
    backgroundColor: Colors.light.backgroundElement,
  },
  dislikeButton: {
    backgroundColor: Colors.light.backgroundElement,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  acknowledged: {
    fontSize: 14,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
