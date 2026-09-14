import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';

const OCCASIONS = ['Повседневный', 'На работу', 'На свидание', 'На вечеринку'] as const;

type Occasion = (typeof OCCASIONS)[number];

export default function CreateOutfitScreen() {
  const [selected, setSelected] = useState<Occasion | null>(null);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle" style={styles.title}>
          Создать образ
        </ThemedText>

        <ThemedText style={styles.question}>Куда ты собираешься?</ThemedText>

        <ThemedView style={styles.options}>
          {OCCASIONS.map((occasion) => {
            const isSelected = selected === occasion;
            return (
              <Pressable
                key={occasion}
                onPress={() => setSelected(occasion)}
                style={({ pressed }) => [
                  styles.option,
                  isSelected && styles.optionSelected,
                  pressed && styles.buttonPressed,
                ]}>
                <ThemedText style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {occasion}
                </ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>

        <Pressable style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
          <ThemedText style={styles.buttonText}>Создать образ</ThemedText>
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
    paddingBottom: BottomTabInset + Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    marginTop: Spacing.three,
    marginBottom: Spacing.four,
  },
  question: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: Spacing.three,
    color: Colors.light.text,
  },
  options: {
    gap: Spacing.two,
    flex: 1,
  },
  option: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 14,
    backgroundColor: Colors.light.backgroundElement,
    alignItems: 'center',
  },
  optionSelected: {
    backgroundColor: Colors.light.text,
  },
  optionText: {
    fontSize: 17,
    fontWeight: '500',
    color: Colors.light.text,
  },
  optionTextSelected: {
    color: Colors.light.background,
  },
  button: {
    backgroundColor: Colors.light.text,
    paddingVertical: Spacing.three + 2,
    paddingHorizontal: Spacing.four,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: Colors.light.background,
    fontSize: 17,
    fontWeight: '600',
  },
});
