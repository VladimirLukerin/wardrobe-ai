import { Pressable, StyleSheet, View } from 'react-native';

import { OutfitItemsGrid } from '@/components/outfit-items-grid';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import type { WardrobeItem } from '@/contexts/wardrobe-context';
import { formatFeedCreatedAt } from '@/utils/wear-date';

export type OutfitFeedCardProps = {
  title: string;
  items: WardrobeItem[];
  sourceLabel: string;
  createdAt: string;
  onPress?: () => void;
  width?: number;
};

export function OutfitFeedCard({
  title,
  items,
  sourceLabel,
  createdAt,
  onPress,
  width = 260,
}: OutfitFeedCardProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        { width },
        onPress && pressed && styles.buttonPressed,
      ]}>
      <ThemedText style={styles.title} numberOfLines={2}>
        {title}
      </ThemedText>
      <OutfitItemsGrid items={items} compact maxVisibleItems={4} />
      <View style={styles.metaRow}>
        <ThemedText themeColor="textSecondary" style={styles.sourceLabel} numberOfLines={1}>
          {sourceLabel}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.createdAt}>
          {formatFeedCreatedAt(createdAt)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    lineHeight: 20,
    minHeight: 40,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  sourceLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  createdAt: {
    fontSize: 12,
    lineHeight: 16,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
