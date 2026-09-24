import { getOutfitDescription } from '@/utils/outfit-description';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import AccountSaveSheet from '@/components/account-save-sheet';
import { HomeAccountReminderCard } from '@/components/home-account-reminder-card';
import { HomeBrandHeader } from '@/components/home-brand-header';
import { EmptyDailyOutfitCard } from '@/components/home/empty-daily-outfit-card';
import { FirstWardrobeItemCard } from '@/components/home/first-wardrobe-item-card';
import { HomeGreeting } from '@/components/home/home-greeting';
import { HomeWeatherHeader } from '@/components/home/home-weather-header';
import { HomeWornNowSection } from '@/components/home/home-worn-now-section';
import { HomeOutfitFeedback } from '@/components/home-outfit-feedback';
import { HomeOutfitPreview } from '@/components/home-outfit-preview';
import { HomeWardrobeSummary } from '@/components/home-wardrobe-summary';
import { PrikinColors, PrikinHomeRadii, PrikinSpacing } from '@/constants/prikin-tokens';
import { Colors, MaxContentWidth, Spacing, TabScreenScrollPadding } from '@/constants/theme';
import { useBodyParameters } from '@/contexts/body-parameters-context';
import { useAccount } from '@/contexts/account-context';
import { useAccountProfile } from '@/contexts/account-profile-context';
import { useOutfits } from '@/contexts/outfits-context';
import { useStylistPreferences } from '@/contexts/stylist-preferences-context';
import { useWardrobe, type WardrobeItem } from '@/contexts/wardrobe-context';
import { NetworkErrorState } from '@/components/network-error-state';
import type { OutfitSuggestion } from '@/services/outfit-suggestions';
import { useHomeDailyData } from '@/contexts/home-daily-content-context';
import { getActiveLocation } from '@/utils/get-active-location';
import { isAccountProtected } from '@/utils/account-is-protected';
import { resolveWardrobeItemsFromIds } from '@/utils/resolve-wardrobe-items';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getWardrobeItemDisplayImageUri } from '@/constants/wardrobe-item';
import type { SavedOutfit } from '@/constants/saved-outfit';
import type { OutfitFeedback, OutfitFeedbackReason } from '@/constants/outfit-feedback';
import { useAddWardrobeItem } from '@/hooks/use-add-wardrobe-item';

const SAVED_OUTFITS_PREVIEW_COUNT = 3;
const WARDROBE_PREVIEW_COUNT = 4;
const HOME_ACCOUNT_REMINDER_MIN_ITEMS = 5;

let homeAccountReminderDismissed = false;

function HomeOutfitCard({
  outfit,
  wardrobeById,
  isSaved,
  isRegenerating,
  regenerateError,
  onToggleSave,
  onRegenerate,
  feedbackEnabled,
  outfitFeedback,
  isFeedbackLoading,
  isFeedbackSubmitting,
  feedbackLoadError,
  feedbackSubmitError,
  onLikeFeedback,
  onDislikeFeedback,
  onRetryFeedbackLoad,
  onRetryFeedbackSubmit,
}: {
  outfit: OutfitSuggestion;
  wardrobeById: Map<string, WardrobeItem>;
  isSaved: boolean;
  isRegenerating: boolean;
  regenerateError: string | null;
  onToggleSave: () => void;
  onRegenerate: () => void;
  feedbackEnabled: boolean;
  outfitFeedback: OutfitFeedback | null;
  isFeedbackLoading: boolean;
  isFeedbackSubmitting: boolean;
  feedbackLoadError: boolean;
  feedbackSubmitError: boolean;
  onLikeFeedback: () => void;
  onDislikeFeedback: (reason: OutfitFeedbackReason | null, targetItemId?: string) => void;
  onRetryFeedbackLoad: () => void;
  onRetryFeedbackSubmit: () => void;
}) {
  const outfitItems = resolveWardrobeItemsFromIds(outfit.itemIds, wardrobeById);
  const outfitSignature = outfit.itemIds.join(',');
  const previewOpacity = useSharedValue(1);

  useEffect(() => {
    if (isRegenerating) {
      previewOpacity.value = withTiming(0.62, { duration: 180 });
    }
  }, [isRegenerating, previewOpacity]);

  useEffect(() => {
    if (!isRegenerating) {
      previewOpacity.value = withTiming(1, { duration: 320 });
    }
  }, [isRegenerating, outfitSignature, previewOpacity]);

  const previewAnimatedStyle = useAnimatedStyle(() => ({
    opacity: previewOpacity.value,
  }));

  if (outfitItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.outfitCard}>
      <ThemedText style={styles.dailyCardHeading}>Твой образ на сегодня</ThemedText>
      <ThemedText style={styles.outfitTitle}>{outfit.title}</ThemedText>
      <View style={styles.previewWrap}>
        <Animated.View style={previewAnimatedStyle}>
          <HomeOutfitPreview items={outfitItems} />
        </Animated.View>
        {isRegenerating && (
          <View style={styles.previewOverlay} pointerEvents="none">
            <ActivityIndicator color={Colors.light.text} />
          </View>
        )}
      </View>
      {outfitItems.length > 0 && (
        <ThemedText
          themeColor="textSecondary"
          style={styles.outfitDescription}
          numberOfLines={2}
          ellipsizeMode="tail">
          {getOutfitDescription(outfit.description, outfitItems, undefined)}
        </ThemedText>
      )}
      {regenerateError && (
        <ThemedText themeColor="textSecondary" style={styles.regenerateError}>
          {regenerateError}
        </ThemedText>
      )}
      <View style={styles.outfitActions}>
        <Pressable
          onPress={onToggleSave}
          disabled={isRegenerating}
          style={({ pressed }) => [
            styles.outfitAction,
            isRegenerating && styles.outfitActionDisabled,
            pressed && !isRegenerating && styles.buttonPressed,
          ]}>
          <ThemedText style={[styles.outfitActionText, isSaved && styles.outfitActionTextActive]}>
            {isSaved ? '♥ Сохранено' : '♡ Сохранить'}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={onRegenerate}
          disabled={isRegenerating}
          style={({ pressed }) => [
            styles.outfitAction,
            isRegenerating && styles.outfitActionDisabled,
            pressed && !isRegenerating && styles.buttonPressed,
          ]}>
          {isRegenerating ? (
            <View style={styles.regeneratingAction}>
              <ActivityIndicator size="small" color={Colors.light.textSecondary} />
              <ThemedText style={styles.outfitActionText}>Подбираем новый образ…</ThemedText>
            </View>
          ) : (
            <ThemedText style={styles.outfitActionText}>↻ Подобрать другой</ThemedText>
          )}
        </Pressable>
      </View>
      <HomeOutfitFeedback
        enabled={feedbackEnabled}
        feedback={outfitFeedback}
        outfitItems={outfitItems}
        isLoading={isFeedbackLoading}
        isSubmitting={isFeedbackSubmitting}
        loadError={feedbackLoadError}
        submitError={feedbackSubmitError}
        onLike={onLikeFeedback}
        onDislike={onDislikeFeedback}
        onRetryLoad={onRetryFeedbackLoad}
        onRetrySubmit={onRetryFeedbackSubmit}
      />
    </View>
  );
}

function CompactSavedOutfitCard({
  outfit,
  wardrobeById,
}: {
  outfit: SavedOutfit;
  wardrobeById: Map<string, WardrobeItem>;
}) {
  const outfitItems = resolveWardrobeItemsFromIds(outfit.itemIds, wardrobeById).slice(0, 4);

  if (outfitItems.length === 0) {
    return null;
  }

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/create-outfit/[id]',
          params: { id: outfit.id },
        })
      }
      style={({ pressed }) => [styles.compactOutfitCard, pressed && styles.buttonPressed]}>
      <View style={styles.compactThumbGrid}>
        {outfitItems.map((item) => (
          <View key={item.id} style={styles.compactThumbWrap}>
            <Image
              source={{ uri: getWardrobeItemDisplayImageUri(item) }}
              style={styles.compactThumb}
              contentFit="contain"
            />
          </View>
        ))}
      </View>
      <ThemedText style={styles.compactOutfitTitle} numberOfLines={2}>
        {outfit.title}
      </ThemedText>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { user } = useAccount();
  const { displayName, isHydrated: isProfileHydrated } = useAccountProfile();
  const { items, isHydrated: isWardrobeHydrated } = useWardrobe();
  const { takePhoto } = useAddWardrobeItem();
  const [isSaveAccountVisible, setIsSaveAccountVisible] = useState(false);
  const [isReminderDismissed, setIsReminderDismissed] = useState(homeAccountReminderDismissed);
  const { savedOutfits, isHydrated: isOutfitsHydrated, isOutfitSaved, toggleSavedOutfit } =
    useOutfits();
  const { considerWeather, isHydrated: isStylistHydrated } =
    useStylistPreferences();
  const {
    locationMode,
    manualLocation,
    autoLocation,
    isHydrated: isBodyHydrated,
  } = useBodyParameters();

  const isFullyHydrated =
    isWardrobeHydrated && isOutfitsHydrated && isStylistHydrated && isBodyHydrated;

  const activeLocation = useMemo(
    () => getActiveLocation({ locationMode, manualLocation, autoLocation }),
    [autoLocation, locationMode, manualLocation],
  );

  const wardrobeById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const {
    loadState,
    homeOutfit,
    guestWeatherAdvice,
    guestHomeCta,
    weather,
    weatherError,
    isWeatherLoading,
    isRegenerating,
    regenerateError,
    outfitErrorKind,
    regenerateOutfit,
    refreshWeather,
    feedbackEnabled,
    outfitFeedback,
    isFeedbackLoading,
    isFeedbackSubmitting,
    feedbackLoadError,
    feedbackSubmitError,
    submitOutfitFeedback,
    retryOutfitFeedbackLoad,
    retryFeedbackSubmit,
  } = useHomeDailyData();



  const visibleSavedOutfits = useMemo(
    () =>
      savedOutfits
        .filter(
          (outfit) => resolveWardrobeItemsFromIds(outfit.itemIds, wardrobeById).length > 0,
        )
        .slice(0, SAVED_OUTFITS_PREVIEW_COUNT),
    [savedOutfits, wardrobeById],
  );

  const wardrobePreviewItems = useMemo(() => items.slice(-WARDROBE_PREVIEW_COUNT).reverse(), [items]);

  const wardrobeCountLabel = useMemo(() => {
    const count = items.length;
    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod10 === 1 && mod100 !== 11) {
      return `${count} вещь`;
    }

    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
      return `${count} вещи`;
    }

    return `${count} вещей`;
  }, [items.length]);

  const handleToggleSaveHomeOutfit = () => {
    if (!homeOutfit) {
      return;
    }

    toggleSavedOutfit({
      title: homeOutfit.title,
      description: homeOutfit.description,
      itemIds: homeOutfit.itemIds,
    });
  };

  const showAccountReminder =
    isFullyHydrated &&
    items.length >= HOME_ACCOUNT_REMINDER_MIN_ITEMS &&
    !isAccountProtected(user) &&
    !isReminderDismissed;

  const handleDismissAccountReminder = () => {
    homeAccountReminderDismissed = true;
    setIsReminderDismissed(true);
  };

  return (
    <ThemedView style={styles.container}>
      {!isFullyHydrated ? (
        <SafeAreaView style={styles.centeredState} edges={['top']}>
          <ActivityIndicator color={Colors.light.text} />
        </SafeAreaView>
      ) : (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.View style={styles.contentWrap}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: TabScreenScrollPadding },
            ]}
            showsVerticalScrollIndicator={false}>
            <HomeBrandHeader />

            {activeLocation ? (
              <HomeWeatherHeader
                locationName={activeLocation.name}
                considerWeather={considerWeather}
                weather={weather}
                isLoading={isWeatherLoading}
                error={weatherError}
                onRetry={() => {
                  void refreshWeather();
                }}
              />
            ) : null}

            <HomeGreeting displayName={displayName} profileHydrated={isProfileHydrated} />

          {showAccountReminder ? (
            <View style={styles.section}>
              <HomeAccountReminderCard
                onSaveAccount={() => setIsSaveAccountVisible(true)}
                onDismiss={handleDismissAccountReminder}
              />
            </View>
          ) : null}

          <View style={styles.dailySection}>
            {loadState === 'empty-wardrobe' && (
              <View style={styles.emptyOutfitBlock}>
                <EmptyDailyOutfitCard />
                <FirstWardrobeItemCard
                  onAddFirstItem={() => {
                    void takePhoto();
                  }}
                />
              </View>
            )}

            {(loadState === 'guest-weather' && guestWeatherAdvice) ? (
              <View style={styles.guestDailyCard}>
                <ThemedText style={styles.dailyCardHeading}>Твой образ на сегодня</ThemedText>
                <ThemedText style={styles.guestAdviceText}>{guestWeatherAdvice}</ThemedText>
                {guestHomeCta ? (
                  <ThemedText themeColor="textSecondary" style={styles.guestAdviceCta}>
                    {guestHomeCta}
                  </ThemedText>
                ) : null}
              </View>
            ) : null}

            {loadState === 'guest-weather' && !guestWeatherAdvice ? (
              <View style={styles.emptyBlock}>
                <Pressable
                  onPress={() => router.push('/garderob')}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
                  <ThemedText style={styles.primaryButtonText}>Открыть гардероб</ThemedText>
                </Pressable>
              </View>
            ) : null}

            {loadState === 'loading' && (
              <View style={styles.guestDailyCard}>
                <ThemedText style={styles.dailyCardHeading}>Твой образ на сегодня</ThemedText>
                <ActivityIndicator color={Colors.light.text} />
                <ThemedText themeColor="textSecondary" style={styles.loadingText}>
                  Подбираем образ на сегодня…
                </ThemedText>
              </View>
            )}

            {loadState === 'error' && outfitErrorKind === 'network' && (
              <NetworkErrorState onRetry={regenerateOutfit} isRetrying={isRegenerating} />
            )}

            {loadState === 'error' && outfitErrorKind !== 'network' && (
              <View style={styles.emptyBlock}>
                <ThemedText style={styles.emptyTitle}>Не удалось подобрать образ</ThemedText>
                <Pressable
                  onPress={regenerateOutfit}
                  style={({ pressed }) => [styles.outfitAction, pressed && styles.buttonPressed]}>
                  <ThemedText style={styles.outfitActionText}>↻ Подобрать другой</ThemedText>
                </Pressable>
              </View>
            )}

            {loadState === 'success' && homeOutfit && (
              <HomeOutfitCard
                outfit={homeOutfit}
                wardrobeById={wardrobeById}
                isSaved={isOutfitSaved(homeOutfit.itemIds)}
                isRegenerating={isRegenerating}
                regenerateError={regenerateError}
                onToggleSave={handleToggleSaveHomeOutfit}
                onRegenerate={regenerateOutfit}
                feedbackEnabled={feedbackEnabled}
                outfitFeedback={outfitFeedback}
                isFeedbackLoading={isFeedbackLoading}
                isFeedbackSubmitting={isFeedbackSubmitting}
                feedbackLoadError={feedbackLoadError}
                feedbackSubmitError={feedbackSubmitError}
                onLikeFeedback={() => {
                  void submitOutfitFeedback('like');
                }}
                onDislikeFeedback={(reason, targetItemId) => {
                  void submitOutfitFeedback('dislike', reason, targetItemId);
                }}
                onRetryFeedbackLoad={() => {
                  void retryOutfitFeedbackLoad();
                }}
                onRetryFeedbackSubmit={() => {
                  retryFeedbackSubmit();
                }}
              />
            )}
          </View>

          <HomeWornNowSection />

          {loadState !== 'empty-wardrobe' && items.length > 0 ? <HomeWardrobeSummary /> : null}

          {visibleSavedOutfits.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <ThemedText style={styles.sectionTitle}>Мои образы</ThemedText>
                <Pressable
                  onPress={() => router.push('/create-outfit')}
                  style={({ pressed }) => [styles.sectionLink, pressed && styles.buttonPressed]}>
                  <ThemedText style={styles.sectionLinkText}>Все образы →</ThemedText>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.savedOutfitsRow}>
                {visibleSavedOutfits.map((outfit) => (
                  <CompactSavedOutfitCard
                    key={outfit.id}
                    outfit={outfit}
                    wardrobeById={wardrobeById}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {items.length > 0 ? (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Гардероб</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.wardrobeCount}>
              {wardrobeCountLabel}
            </ThemedText>
            {wardrobePreviewItems.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.wardrobePreviewRow}>
                {wardrobePreviewItems.map((item) => (
                  <View key={item.id} style={styles.wardrobePreviewThumbWrap}>
                    <Image
                      source={{ uri: getWardrobeItemDisplayImageUri(item) }}
                      style={styles.wardrobePreviewThumb}
                      contentFit="contain"
                    />
                  </View>
                ))}
              </ScrollView>
            )}
            <Pressable
              onPress={() => router.push('/garderob')}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}>
              <ThemedText style={styles.secondaryButtonText}>Открыть гардероб</ThemedText>
            </Pressable>
          </View>
          ) : null}
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
      )}
      <AccountSaveSheet
        visible={isSaveAccountVisible}
        onClose={() => setIsSaveAccountVisible(false)}
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
  contentWrap: {
    flex: 1,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: PrikinSpacing.screenHorizontal,
    gap: PrikinSpacing.homeSectionGap,
  },
  dailySection: {
    gap: PrikinSpacing.homeSectionGap,
  },
  dailyCardHeading: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    color: PrikinColors.textPrimary,
  },
  guestDailyCard: {
    backgroundColor: PrikinColors.surface,
    borderRadius: PrikinHomeRadii.card,
    padding: PrikinSpacing.homeCardPadding,
    gap: PrikinSpacing.homeCardGap,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PrikinColors.borderSubtle,
  },
  emptyOutfitBlock: {
    alignItems: 'stretch',
    gap: PrikinSpacing.homeSectionGap,
  },
  section: {
    gap: PrikinSpacing.homeSectionGap,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  sectionLink: {
    paddingVertical: Spacing.one,
  },
  sectionLinkText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  loadingText: {
    fontSize: 13,
    lineHeight: 18,
  },
  guestAdviceText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.light.text,
  },
  guestAdviceCta: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyBlock: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    backgroundColor: PrikinColors.surface,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PrikinColors.borderSubtle,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  outfitCard: {
    backgroundColor: PrikinColors.surface,
    borderRadius: PrikinHomeRadii.card,
    padding: PrikinSpacing.homeCardPadding,
    gap: PrikinSpacing.homeCardGap,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PrikinColors.borderSubtle,
  },
  outfitTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  previewWrap: {
    position: 'relative',
  },
  previewOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(240, 240, 243, 0.45)',
  },
  regenerateError: {
    fontSize: 13,
    lineHeight: 18,
  },
  regeneratingAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  outfitActionDisabled: {
    opacity: 0.55,
  },
  outfitDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  outfitActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
  },
  outfitAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: Spacing.two,
  },
  outfitActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  outfitActionTextActive: {
    color: Colors.light.text,
  },
  savedOutfitsRow: {
    gap: Spacing.two,
    paddingRight: Spacing.two,
  },
  compactOutfitCard: {
    width: 132,
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 16,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  compactThumbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  compactThumbWrap: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: Colors.light.background,
    overflow: 'hidden',
  },
  compactThumb: {
    width: '100%',
    height: '100%',
    padding: 2,
  },
  compactOutfitTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
    lineHeight: 17,
    minHeight: 34,
  },
  wardrobeCount: {
    fontSize: 15,
    lineHeight: 22,
  },
  wardrobePreviewRow: {
    gap: Spacing.two,
  },
  wardrobePreviewThumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundElement,
    overflow: 'hidden',
  },
  wardrobePreviewThumb: {
    width: '100%',
    height: '100%',
    padding: Spacing.one,
  },
  primaryButton: {
    marginTop: Spacing.two,
    backgroundColor: Colors.light.text,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 14,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.background,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: Colors.light.text,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.four,
    borderRadius: 14,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
