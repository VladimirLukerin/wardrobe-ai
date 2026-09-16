import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  COLOR_PREFERENCE_OPTIONS,
  STYLE_PREFERENCE_OPTIONS,
  type ColorPreference,
  type StylePreference,
} from '@/constants/style-preferences';
import { Colors, MaxContentWidth, Spacing, TabScreenScrollPadding } from '@/constants/theme';
import { useStylePreferences } from '@/contexts/style-preferences-context';

function toggleItem<T extends string>(items: T[], item: T): T[] {
  return items.includes(item) ? items.filter((value) => value !== item) : [...items, item];
}

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}>
      <ThemedText style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</ThemedText>
    </Pressable>
  );
}

export default function MyStyleScreen() {
  const { styles: savedStyles, colors: savedColors, setStylePreferences } = useStylePreferences();
  const [selectedStyles, setSelectedStyles] = useState<StylePreference[]>(savedStyles);
  const [selectedColors, setSelectedColors] = useState<ColorPreference[]>(savedColors);

  const handleSave = () => {
    setStylePreferences({
      styles: selectedStyles,
      colors: selectedColors,
    });
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle" style={styles.title}>
          Мой стиль
        </ThemedText>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Какие стили вам нравятся?</ThemedText>
            <View style={styles.chipGroup}>
              {STYLE_PREFERENCE_OPTIONS.map((style) => (
                <Chip
                  key={style}
                  label={style}
                  selected={selectedStyles.includes(style)}
                  onPress={() => setSelectedStyles((current) => toggleItem(current, style))}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Любимые цвета</ThemedText>
            <View style={styles.chipGroup}>
              {COLOR_PREFERENCE_OPTIONS.map((color) => (
                <Chip
                  key={color}
                  label={color}
                  selected={selectedColors.includes(color)}
                  onPress={() => setSelectedColors((current) => toggleItem(current, color))}
                />
              ))}
            </View>
          </View>
        </ScrollView>

        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
          <ThemedText style={styles.saveButtonText}>Сохранить</ThemedText>
        </Pressable>
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
    paddingBottom: TabScreenScrollPadding,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    marginTop: Spacing.three,
    marginBottom: Spacing.four,
  },
  scrollContent: {
    gap: Spacing.five,
    paddingBottom: Spacing.four,
  },
  section: {
    gap: Spacing.three,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundElement,
  },
  chipSelected: {
    backgroundColor: Colors.light.text,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
  },
  chipTextSelected: {
    color: Colors.light.background,
  },
  saveButton: {
    backgroundColor: Colors.light.text,
    paddingVertical: Spacing.three + 2,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: Colors.light.background,
    fontSize: 17,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
