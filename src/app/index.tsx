import { getOutfitDescription } from '@/utils/outfit-description';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeBrandHeader } from '@/components/home-brand-header';
import { HomeOutfitPreview } from '@/components/home-outfit-preview';
import { HomeOutfitFeed } from '@/components/home-outfit-feed';
import { HomeWardrobeSummary } from '@/components/home-wardrobe-summary';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getWardrobeItemDisplayImageUri } from '@/constants/wardrobe-item';
import type { SavedOutfit } from '@/constants/saved-outfit';
import { Colors, OutfitColors, MaxContentWidth, Spacing, TabScreenScrollPadding } from '@/constants/theme';
import { useBodyParameters } from '@/contexts/body-parameters-context';
import { useOutfits } from '@/contexts/outfits-context';
import { useStylistPreferences } from '@/contexts/stylist-preferences-context';
import { useWardrobe, type WardrobeItem } from '@/contexts/wardrobe-context';
import type { OutfitSuggestion, OutfitWeather } from '@/services/outfit-suggestions';
import { useHomeDailyData } from '@/contexts/home-daily-content-context';
import { getActiveLocation } from '@/utils/get-active-location';
import { resolveWardrobeItemsFromIds } from '@/utils/resolve-wardrobe-items';
import { formatWeatherTemperature, getWeatherCodeLabel } from '@/utils/weather-code';

const SAVED_OUTFITS_PREVIEW_COUNT = 3;
const WARDROBE_PREVIEW_COUNT = 4;

function HomeWeatherBlock({
  locationName,
  weather,
  isLoading,
}: {
  locationName: string;
  weather: OutfitWeather | null;
  isLoading: boolean;
}) {
  return (
    <View style={styles.weatherBlock}>
      <ThemedText style={styles.weatherLocation}>{locationName}</ThemedText>
      {weather ? (
        <>
          <ThemedText style={styles.weatherTemperature}>
            {formatWeatherTemperature(weather.temperatureC)}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.weatherFeelsLike}>
            Ощущается как {formatWeatherTemperature(weather.apparentTemperatureC)}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.weatherDetails}>
            {getWeatherCodeLabel(weather.weatherCode)} · ветер {Math.round(weather.windSpeedKmh)} км/ч
          </ThemedText>
        </>
      ) : isLoading ? (
        <ThemedText themeColor="textSecondary" style={styles.weatherLoading}>
          Загружаем погоду…
        </ThemedText>
      ) : null}
    </View>
  );
}

function HomeOutfitCard({
  outfit,
  wardrobeById,
  isSaved,
  isRegenerating,
  regenerateError,
  onToggleSave,
  onRegenerate,
}: {
  outfit: OutfitSuggestion;
  wardrobeById: Map<string, WardrobeItem>;
  isSaved: boolean;
  isRegenerating: boolean;
  regenerateError: string | null;
  onToggleSave: () => void;
  onRegenerate: () => void;
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
  const { items, isHydrated: isWardrobeHydrated } = useWardrobe();
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
    weather,
    isWeatherLoading,
    isRegenerating,
    regenerateError,
    regenerateOutfit,
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

          {considerWeather && activeLocation && (
            <HomeWeatherBlock
              locationName={activeLocation.name}
              weather={weather}
              isLoading={isWeatherLoading}
            />
          )}

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Что надеть сегодня</ThemedText>

            {loadState === 'empty-wardrobe' && (
              <View style={styles.emptyBlock}>
                <ThemedText style={styles.emptyTitle}>Добавьте вещи в гардероб</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.emptySubtitle}>
                  Когда в гардеробе появится несколько вещей, я смогу подобрать образ на сегодня.
                </ThemedText>
                <Pressable
                  onPress={() => router.push('/garderob')}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
                  <ThemedText style={styles.primaryButtonText}>Открыть гардероб</ThemedText>
                </Pressable>
              </View>
            )}

            {loadState === 'loading' && (
              <View style={styles.loadingBlock}>
                <ActivityIndicator color={Colors.light.text} />
                <ThemedText themeColor="textSecondary" style={styles.loadingText}>
                  Подбираем образ на сегодня…
                </ThemedText>
              </View>
            )}

            {loadState === 'error' && (
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
              />
            )}
          </View>

          <HomeOutfitFeed />

          <HomeWardrobeSummary />

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
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
      )}
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
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  weatherBlock: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  weatherLocation: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  weatherTemperature: {
    fontSize: 28,
    fontWeight: '600',
    color: Colors.light.text,
    lineHeight: 34,
  },
  weatherFeelsLike: {
    fontSize: 14,
    lineHeight: 20,
  },
  weatherDetails: {
    fontSize: 14,
    lineHeight: 20,
  },
  weatherLoading: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    gap: Spacing.three,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 18,
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
  loadingBlock: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 16,
  },
  loadingText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  emptyBlock: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 16,
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
    backgroundColor: OutfitColors.surface,
    borderRadius: 24,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  outfitTitle: {
    fontSize: 20,
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
