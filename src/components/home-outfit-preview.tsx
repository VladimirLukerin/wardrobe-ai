import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { getWardrobeItemDisplayImageUri } from '@/constants/wardrobe-item';
import { Colors, OutfitColors, Spacing } from '@/constants/theme';
import type { WardrobeItem } from '@/contexts/wardrobe-context';
import { sortOutfitItems } from '@/utils/outfit-item-replacement';

type Props = {
  items: WardrobeItem[];
  compact?: boolean;
  onReplace?: (itemId: string) => void;
  disabled?: boolean;
  lockedItemId?: string;
};

export function HomeOutfitPreview({ items, onReplace, disabled, lockedItemId, compact = false }: Props) {
  return (
    <View style={[styles.preview, compact && styles.compactPreview]}>
      {sortOutfitItems(items).map((item) => (
        <View key={item.id} style={[styles.row, compact && styles.compactRow]}>
          <Image source={{ uri: getWardrobeItemDisplayImageUri(item) }} style={[styles.image, compact && styles.compactImage]} contentFit="contain" accessibilityLabel={item.name} />
          <View style={[styles.details, compact && styles.compactDetails]}>
            {!compact && <ThemedText style={styles.category}>{item.category}</ThemedText>}
            <ThemedText style={[styles.name, compact && styles.compactName]} numberOfLines={compact ? 2 : undefined}>{item.name}</ThemedText>
            {lockedItemId === item.id ? <ThemedText themeColor="textSecondary">Основная вещь</ThemedText> : onReplace && (
              <Pressable accessibilityRole="button" accessibilityLabel={`Заменить: ${item.name}`} disabled={disabled}
                onPress={() => onReplace(item.id)} style={({ pressed }) => [styles.replace, (pressed || disabled) && { opacity: 0.5 }]}>
                <ThemedText style={styles.replaceText}>Заменить ↔</ThemedText>
              </Pressable>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  compactPreview: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  compactRow: { width: '48%', flexDirection: 'column', alignItems: 'stretch', gap: 0, padding: 8, borderRadius: 14 },
  compactImage: { width: '100%', height: 100 },
  compactDetails: { flex: 0, gap: 0, paddingVertical: 0 },
  compactName: { fontSize: 13, lineHeight: 17, minHeight: 34 },
  preview: { gap: Spacing.two, width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.two, borderRadius: 18, backgroundColor: Colors.light.background },
  image: { width: '47%', height: 146 },
  details: { flex: 1, gap: Spacing.one, paddingVertical: Spacing.two },
  category: { fontSize: 12, color: Colors.light.textSecondary },
  name: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  replace: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, marginTop: 4, borderRadius: 14, backgroundColor: OutfitColors.button },
  replaceText: { color: OutfitColors.accent, fontSize: 14, fontWeight: '600' },
});
