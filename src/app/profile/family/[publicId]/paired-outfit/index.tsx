import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PAIRED_OCCASION_OPTIONS } from '@/constants/paired-outfit';
import { Colors, MaxContentWidth, Spacing, TabScreenScrollPadding } from '@/constants/theme';
import { useFamily } from '@/contexts/family-context';
import { getFamilyMemberLabel } from '@/constants/family';

export default function PairedOutfitOccasionScreen() {
  const { publicId: publicIdParam } = useLocalSearchParams<{ publicId: string }>();
  const publicId = typeof publicIdParam === 'string' ? publicIdParam : '';
  const { members } = useFamily();
  const [selectedOccasionId, setSelectedOccasionId] = useState<string | null>(null);
  const [customOccasion, setCustomOccasion] = useState('');

  const member = useMemo(
    () => members.find((entry) => entry.publicId === publicId) ?? null,
    [members, publicId],
  );
  const memberLabel = member ? getFamilyMemberLabel(member) : publicId;

  const canContinue =
    selectedOccasionId !== null &&
    (selectedOccasionId !== 'other' || customOccasion.trim().length > 0);

  const handleContinue = () => {
    if (!publicId || !selectedOccasionId || !canContinue) {
      return;
    }

    router.push({
      pathname: '/profile/family/[publicId]/paired-outfit/matching',
      params: {
        publicId,
        occasionId: selectedOccasionId,
        customOccasion: selectedOccasionId === 'other' ? customOccasion.trim() : '',
      },
    });
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText style={styles.backLink}>Назад</ThemedText>
            </Pressable>
          </View>

          <View style={styles.titleBlock}>
            <ThemedText style={styles.title}>Совместный образ</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Куда идёте с {memberLabel}?
            </ThemedText>
          </View>

          <View style={styles.optionsBlock}>
            {PAIRED_OCCASION_OPTIONS.map((option) => {
              const isSelected = selectedOccasionId === option.id;

              return (
                <Pressable
                  key={option.id}
                  onPress={() => setSelectedOccasionId(option.id)}
                  style={({ pressed }) => [
                    styles.optionRow,
                    isSelected && styles.optionRowSelected,
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {option.label}
                  </ThemedText>
                  {isSelected ? (
                    <SymbolView
                      name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                      size={20}
                      tintColor={Colors.light.text}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {selectedOccasionId === 'other' ? (
            <View style={styles.customOccasionBlock}>
              <ThemedText themeColor="textSecondary" style={styles.customOccasionLabel}>
                Опишите ситуацию
              </ThemedText>
              <TextInput
                value={customOccasion}
                onChangeText={setCustomOccasion}
                placeholder="Например, поездка на дачу"
                placeholderTextColor={Colors.light.textSecondary}
                style={styles.customOccasionInput}
                maxLength={80}
                autoFocus
              />
            </View>
          ) : null}

          <Pressable
            onPress={handleContinue}
            disabled={!canContinue}
            style={({ pressed }) => [
              styles.continueButton,
              !canContinue && styles.continueButtonDisabled,
              pressed && canContinue && styles.pressed,
            ]}>
            <ThemedText style={styles.continueButtonText}>Далее</ThemedText>
          </Pressable>
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
  titleBlock: {
    gap: Spacing.one,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  optionsBlock: {
    gap: Spacing.one,
  },
  optionRow: {
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.backgroundSelected,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  optionRowSelected: {
    borderColor: Colors.light.text,
    backgroundColor: Colors.light.backgroundSelected,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  optionLabelSelected: {
    fontWeight: '600',
  },
  customOccasionBlock: {
    gap: Spacing.one,
  },
  customOccasionLabel: {
    fontSize: 14,
    lineHeight: 20,
  },
  customOccasionInput: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.backgroundSelected,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    color: Colors.light.text,
    backgroundColor: Colors.light.background,
  },
  continueButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: Colors.light.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.45,
  },
  continueButtonText: {
    color: Colors.light.background,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
