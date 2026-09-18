import { getOutfitDescription, describeOutfitItems } from '@/utils/outfit-description';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeOutfitPreview } from '@/components/home-outfit-preview';
import { OutfitReplacementSheet } from '@/components/outfit-replacement-sheet';
import { replaceOutfitItem } from '@/utils/outfit-item-replacement';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { STYLE_EXPERIMENT_OUTFIT_LABELS } from '@/constants/stylist-preferences';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useBodyParameters } from '@/contexts/body-parameters-context';
import { useStylistPreferences } from '@/contexts/stylist-preferences-context';
import { useOutfits } from '@/contexts/outfits-context';
import { useWearHistory } from '@/contexts/wear-history-context';
import { useWardrobe, type WardrobeItem } from '@/contexts/wardrobe-context';
import { buildStylistContext } from '@/utils/build-stylist-context';
import {
  OutfitSuggestionError,
  suggestOutfits,
  type OutfitSuggestion,
  type OutfitSuggestionErrorCode,
  type OutfitWeather,
} from '@/services/outfit-suggestions';
import { NetworkErrorState } from '@/components/network-error-state';
import { getActiveLocation } from '@/utils/get-active-location';
import { resolveWardrobeItemsFromIds } from '@/utils/resolve-wardrobe-items';
import { formatOutfitWeatherLine } from '@/utils/weather-code';

type LoadState = 'idle' | 'loading' | 'success' | 'error' | 'empty-wardrobe';

function OutfitCard({
  outfit,
  wardrobeById,
  selectedItemId,
}: {
  outfit: OutfitSuggestion;
  wardrobeById: Map<string, WardrobeItem>;
  selectedItemId: string;
}) {
  const { isOutfitSaved, toggleSavedOutfit } = useOutfits();
  const [draft, setDraft] = useState<OutfitSuggestion | null>(null);
  const [replacementTarget, setReplacementTarget] = useState<string | null>(null);
  const { items } = useWardrobe();
  useEffect(() => { setDraft(null); setReplacementTarget(null); }, [outfit]);
  const activeOutfit = draft ?? outfit;
  const outfitItems = resolveWardrobeItemsFromIds(activeOutfit.itemIds, wardrobeById);
  const isSaved = isOutfitSaved(activeOutfit.itemIds);

  const handleToggleSave = () => {
    toggleSavedOutfit({
      title: activeOutfit.title,
      description: activeOutfit.description,
      itemIds: activeOutfit.itemIds,
    });
  };

  return (
    <View style={styles.outfitCard}>
      <ThemedText style={styles.outfitTitle}>{activeOutfit.title}</ThemedText>

      <HomeOutfitPreview items={outfitItems} onReplace={setReplacementTarget} lockedItemId={selectedItemId} />
      <OutfitReplacementSheet targetId={replacementTarget} itemIds={activeOutfit.itemIds} wardrobe={items}
        onClose={() => setReplacementTarget(null)} onSelect={(target, replacement) => {
          if (target === selectedItemId) return;
          const nextIds = replaceOutfitItem(activeOutfit.itemIds, target, replacement, items);
          if (!nextIds) return;
          setDraft({ ...activeOutfit, title: 'Твой вариант', itemIds: nextIds, description: describeOutfitItems(items.filter((item) => nextIds.includes(item.id))) });
          setReplacementTarget(null);
        }} />

      {outfitItems.length > 0 && (
        <ThemedText themeColor="textSecondary" style={styles.outfitDescription} numberOfLines={2}>
          {getOutfitDescription(activeOutfit.description, outfitItems, undefined)}
        </ThemedText>
      )}

      <Pressable
        onPress={handleToggleSave}
        style={({ pressed }) => [styles.saveButton, pressed && styles.buttonPressed]}>
        <ThemedText style={[styles.saveButtonText, isSaved && styles.saveButtonTextSaved]}>
          {isSaved ? '♥ Сохранено' : '♡ Сохранить образ'}
        </ThemedText>
      </Pressable>
    </View>
  );
}

export default function OutfitSuggestionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { items, isHydrated } = useWardrobe();
  const { savedOutfits } = useOutfits();
  const { wearEvents, getItemWearCount, getItemLastWornAt } = useWearHistory();
  const stylistPreferences = useStylistPreferences();
  const {
    styleExperiment,
    considerWeather,
    wardrobeMode,
    avoidRepeatedOutfits,
    dailyStylistEnabled,
    dailyStylistTime,
    timezone,
    isHydrated: isStylistHydrated,
  } = stylistPreferences;
  const {
    weatherSensitivity,
    fitPreference,
    locationMode,
    manualLocation,
    autoLocation,
    isHydrated: isBodyHydrated,
  } = useBodyParameters();

  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorKind, setErrorKind] = useState<OutfitSuggestionErrorCode | null>(null);
  const [outfits, setOutfits] = useState<OutfitSuggestion[]>([]);
  const [weather, setWeather] = useState<OutfitWeather | null>(null);
  const requestRef = useRef(0);

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

  const selectedItem = useMemo(
    () => items.find((entry) => entry.id === id),
    [items, id],
  );

  const wardrobeById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const hasEnoughItems = items.length >= 2;

  const loadOutfits = useCallback(async () => {
    if (!id || !selectedItem || !hasEnoughItems) {
      return;
    }

    const requestId = ++requestRef.current;
    setLoadState('loading');
    setErrorKind(null);
    setOutfits([]);
    setWeather(null);

    try {
      const stylistContext = buildStylistContext({
        wardrobe: items,
        savedOutfits,
        wearEvents,
        wearHistory: { getItemWearCount, getItemLastWornAt },
        stylistPreferences: {
          styleExperiment,
          considerWeather,
          wardrobeMode,
          avoidRepeatedOutfits,
          dailyStylistEnabled,
          dailyStylistTime,
          timezone,
        },
        userParameters: { fitPreference, weatherSensitivity },
        location: requestLocation,
      });
      const result = await suggestOutfits({
        selectedItemId: id,
        stylistContext,
      });

      if (requestId !== requestRef.current) {
        return;
      }

      if (result.outfits.length === 0) {
        setErrorKind('server');
        setLoadState('error');
        return;
      }

      setOutfits(result.outfits);
      setWeather(result.weather);
      setLoadState('success');
    } catch (error) {
      if (requestId !== requestRef.current) {
        return;
      }

      if (error instanceof OutfitSuggestionError) {
        setErrorKind(error.code);
      } else {
        console.error('Unexpected outfit suggestion error:', error);
        setErrorKind('server');
      }

      setLoadState('error');
    }
  }, [
    avoidRepeatedOutfits,
    considerWeather,
    fitPreference,
    getItemLastWornAt,
    getItemWearCount,
    hasEnoughItems,
    id,
    items,
    requestLocation,
    savedOutfits,
    selectedItem,
    styleExperiment,
    wardrobeMode,
    wearEvents,
    weatherSensitivity,
  ]);

  const styleExperimentLabel = STYLE_EXPERIMENT_OUTFIT_LABELS[styleExperiment];
  const weatherLine =
    considerWeather && weather
      ? formatOutfitWeatherLine(weather, requestLocation?.name)
      : null;

  useEffect(() => {
    if (!isHydrated || !isStylistHydrated || !isBodyHydrated) {
      return;
    }

    if (!id || !selectedItem) {
      return;
    }

    if (!hasEnoughItems) {
      setLoadState('empty-wardrobe');
      return;
    }

    void loadOutfits();

    return () => {
      requestRef.current += 1;
    };
  }, [hasEnoughItems, id, isBodyHydrated, isHydrated, isStylistHydrated, loadOutfits, selectedItem]);

  const handleBack = () => {
    router.back();
  };

  if (!isHydrated || !isStylistHydrated || !isBodyHydrated) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centeredState}>
          <ActivityIndicator color={Colors.light.text} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!id || !selectedItem) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centeredState}>
          <ThemedText style={styles.stateTitle}>Вещь не найдена</ThemedText>
          <Pressable onPress={handleBack} style={({ pressed }) => [styles.textButton, pressed && styles.buttonPressed]}>
            <ThemedText style={styles.textButtonLabel}>← Назад</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={({ pressed }) => [styles.headerBack, pressed && styles.buttonPressed]}>
            <SymbolView
              name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
              size={18}
              tintColor={Colors.light.text}
            />
            <ThemedText style={styles.headerBackText}>Назад</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>С чем носить</ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, Spacing.three) },
          ]}
          showsVerticalScrollIndicator={false}>
          {(loadState === 'loading' || loadState === 'success') && (
            <View style={styles.contextHints}>
              {weatherLine && (
                <ThemedText themeColor="textSecondary" style={styles.weatherHint}>
                  {weatherLine}
                </ThemedText>
              )}
              <ThemedText themeColor="textSecondary" style={styles.modeHint}>
                Подбор: {styleExperimentLabel}
              </ThemedText>
            </View>
          )}

          {loadState === 'loading' && (
            <View style={styles.centeredContent}>
              <ActivityIndicator color={Colors.light.text} />
              <ThemedText style={styles.loadingTitle}>Подбираем образы…</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.loadingSubtitle}>
                Смотрим, что лучше сочетается с этой вещью
              </ThemedText>
            </View>
          )}

          {loadState === 'empty-wardrobe' && (
            <View style={styles.centeredContent}>
              <ThemedText style={styles.stateTitle}>Пока не из чего собрать образ</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.stateSubtitle}>
                Добавьте ещё несколько вещей в гардероб.
              </ThemedText>
            </View>
          )}

          {loadState === 'error' && errorKind === 'network' && (
            <View style={styles.centeredContent}>
              <NetworkErrorState
                onRetry={() => {
                  void loadOutfits();
                }}
                style={styles.networkErrorCard}
              />
            </View>
          )}

          {loadState === 'error' && errorKind !== 'network' && (
            <View style={styles.centeredContent}>
              <ThemedText style={styles.stateTitle}>Не удалось подобрать образы</ThemedText>
              <Pressable
                onPress={() => {
                  void loadOutfits();
                }}
                style={({ pressed }) => [styles.retryButton, pressed && styles.buttonPressed]}>
                <ThemedText style={styles.retryButtonText}>Попробовать снова</ThemedText>
              </Pressable>
            </View>
          )}

          {loadState === 'success' && outfits.length === 0 && (
            <View style={styles.centeredContent}>
              <ThemedText style={styles.stateTitle}>Не удалось подобрать образы</ThemedText>
              <Pressable
                onPress={() => {
                  void loadOutfits();
                }}
                style={({ pressed }) => [styles.retryButton, pressed && styles.buttonPressed]}>
                <ThemedText style={styles.retryButtonText}>Попробовать снова</ThemedText>
              </Pressable>
            </View>
          )}

          {loadState === 'success' &&
            outfits.map((outfit) => (
              <OutfitCard
                key={outfit.id}
                outfit={outfit}
                wardrobeById={wardrobeById}
                selectedItemId={id}
              />
            ))}

          {loadState === 'success' && outfits.length > 0 && (
            <Pressable
              onPress={() => {
                void loadOutfits();
              }}
              style={({ pressed }) => [styles.regenerateButton, pressed && styles.buttonPressed]}>
              <ThemedText style={styles.regenerateButtonText}>↻ Подобрать ещё</ThemedText>
            </Pressable>
          )}
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
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  headerBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minWidth: 88,
  },
  headerBackText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
  },
  headerSpacer: {
    minWidth: 88,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    flexGrow: 1,
  },
  contextHints: {
    gap: Spacing.one,
    alignItems: 'center',
  },
  weatherHint: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  modeHint: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.two,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  networkErrorCard: {
    alignSelf: 'stretch',
  },
  stateSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.two,
    borderWidth: 1.5,
    borderColor: Colors.light.text,
    borderRadius: 14,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.four,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  textButton: {
    paddingVertical: Spacing.two,
  },
  textButtonLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  outfitCard: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    alignSelf: 'stretch',
  },
  outfitTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  outfitDescription: {
    fontSize: 15,
    lineHeight: 22,
    flexShrink: 1,
    width: '100%',
  },
  saveButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  saveButtonTextSaved: {
    color: Colors.light.text,
  },
  regenerateButton: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  regenerateButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
