import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NetworkErrorCard } from '@/components/network-error-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getFamilyMemberLabel } from '@/constants/family';
import {
  DEFAULT_PAIRED_MATCHING_MODE,
  PAIRED_MATCHING_MODE_OPTIONS,
  resolvePairedOccasionLabel,
  type PairedMatchingMode,
} from '@/constants/paired-outfit';
import { Colors, MaxContentWidth, Spacing, TabScreenScrollPadding } from '@/constants/theme';
import { useBodyParameters } from '@/contexts/body-parameters-context';
import { useFamily } from '@/contexts/family-context';
import { AccountApiError } from '@/services/account';
import { getAiRateLimitUserMessage, isAiRateLimitedError } from '@/utils/ai-rate-limit-error';
import { fetchPairedOutfits } from '@/services/paired-outfits';
import { getActiveLocation } from '@/utils/get-active-location';
import { isRetryableNetworkError } from '@/utils/network-error';
import { setPairedOutfitResultCache } from '@/utils/paired-outfit-result-cache';
import { getAuthToken } from '@/storage/auth-token-storage';

export default function PairedOutfitMatchingScreen() {
  const {
    publicId: publicIdParam,
    occasionId: occasionIdParam,
    customOccasion: customOccasionParam,
  } = useLocalSearchParams<{
    publicId: string;
    occasionId: string;
    customOccasion?: string;
  }>();
  const publicId = typeof publicIdParam === 'string' ? publicIdParam : '';
  const occasionId = typeof occasionIdParam === 'string' ? occasionIdParam : '';
  const customOccasion = typeof customOccasionParam === 'string' ? customOccasionParam : '';
  const { members } = useFamily();
  const { locationMode, manualLocation, autoLocation } = useBodyParameters();
  const [matchingMode, setMatchingMode] = useState<PairedMatchingMode>(DEFAULT_PAIRED_MATCHING_MODE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const member = useMemo(
    () => members.find((entry) => entry.publicId === publicId) ?? null,
    [members, publicId],
  );
  const memberLabel = member ? getFamilyMemberLabel(member) : publicId;
  const occasion = resolvePairedOccasionLabel(occasionId, customOccasion);

  const activeLocation = useMemo(
    () => getActiveLocation({ locationMode, manualLocation, autoLocation }),
    [autoLocation, locationMode, manualLocation],
  );

  const requestLocation = useMemo(() => {
    if (!activeLocation) {
      return null;
    }

    return {
      latitude: activeLocation.latitude,
      longitude: activeLocation.longitude,
      name: activeLocation.name,
    };
  }, [activeLocation]);

  const handleSubmit = async () => {
    if (!publicId || !occasionId) {
      return;
    }

    setIsSubmitting(true);
    setNetworkError(false);
    setSubmitError(null);

    try {
      const token = await getAuthToken();

      if (!token) {
        setSubmitError('Не удалось получить токен авторизации.');
        return;
      }

      const result = await fetchPairedOutfits(token, publicId, {
        occasion,
        matchingMode,
        location: requestLocation,
      });

      setPairedOutfitResultCache({
        result,
        occasion,
        matchingMode,
        memberPublicId: publicId,
      });

      router.push({
        pathname: '/profile/family/[publicId]/paired-outfit/result',
        params: {
          publicId,
          occasion,
          matchingMode,
        },
      });
    } catch (error) {
      if (isRetryableNetworkError(error)) {
        setNetworkError(true);
        return;
      }

      if (error instanceof AccountApiError) {
        setSubmitError(isAiRateLimitedError(error) ? getAiRateLimitUserMessage(error) : error.message);
        return;
      }

      setSubmitError('Не удалось подобрать совместный образ.');
    } finally {
      setIsSubmitting(false);
    }
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
            <ThemedText style={styles.title}>Как хотим сочетаться</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              {occasion} · с {memberLabel}
            </ThemedText>
          </View>

          <View style={styles.optionsBlock}>
            {PAIRED_MATCHING_MODE_OPTIONS.map((option) => {
              const isSelected = matchingMode === option.id;

              return (
                <Pressable
                  key={option.id}
                  onPress={() => setMatchingMode(option.id)}
                  style={({ pressed }) => [
                    styles.optionRow,
                    isSelected && styles.optionRowSelected,
                    pressed && styles.pressed,
                  ]}>
                  <View style={styles.optionTextBlock}>
                    <ThemedText style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                      {option.label}
                    </ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.optionDescription}>
                      {option.description}
                    </ThemedText>
                  </View>
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

          <Pressable
            onPress={() => {
              void handleSubmit();
            }}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.continueButton,
              isSubmitting && styles.continueButtonDisabled,
              pressed && !isSubmitting && styles.pressed,
            ]}>
            {isSubmitting ? (
              <ActivityIndicator color={Colors.light.background} />
            ) : (
              <ThemedText style={styles.continueButtonText}>Подобрать образы</ThemedText>
            )}
          </Pressable>

          {networkError ? (
            <NetworkErrorCard
              compact
              onRetry={() => {
                void handleSubmit();
              }}
            />
          ) : null}

          {submitError ? (
            <ThemedText themeColor="textSecondary" style={styles.errorText}>
              {submitError}
            </ThemedText>
          ) : null}
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
    minHeight: 72,
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
  optionTextBlock: {
    flex: 1,
    gap: Spacing.half,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  optionLabelSelected: {
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  continueButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: Colors.light.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueButtonText: {
    color: Colors.light.background,
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
