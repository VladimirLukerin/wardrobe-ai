import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import {
  CLOTHING_SIZES,
  FIT_PREFERENCES,
  SHOE_SIZES_EU,
  WEATHER_SENSITIVITIES,
  type BodyParameters,
  type ClothingSize,
  type FitPreference,
  type LocationMode,
  type ManualLocation,
  type ShoeSizeEu,
  type WeatherSensitivity,
} from '@/constants/body-parameters';
import { Colors, Spacing } from '@/constants/theme';
import { useBodyParameters } from '@/contexts/body-parameters-context';
import { usePreferencesSync } from '@/contexts/preferences-sync-context';
import { useUserLocation, type AutoLocationStatus } from '@/hooks/use-user-location';
import {
  CITY_SEARCH_MIN_QUERY_LENGTH,
  formatCityLabel,
  searchCities,
} from '@/services/location-search';

type BodyParametersSheetProps = {
  visible: boolean;
  onClose: () => void;
  initialScreen?: SheetScreen;
};

type SheetScreen = 'main' | 'location';

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

function SectionTitle({ children }: { children: string }) {
  return <ThemedText style={styles.sectionTitle}>{children}</ThemedText>;
}

type LocationSummary = {
  title: string;
  subtitle: string;
  showRefresh: boolean;
};

function getLocationSummary(
  draft: BodyParameters,
  autoLocationStatus: AutoLocationStatus,
): LocationSummary {
  if (draft.locationMode === 'auto' && autoLocationStatus === 'loading') {
    return {
      title: 'Определяем местоположение...',
      subtitle: '',
      showRefresh: false,
    };
  }

  if (draft.locationMode === 'auto' && autoLocationStatus === 'permission_denied') {
    return {
      title: 'Нет доступа к геолокации',
      subtitle: 'Разрешите доступ в настройках или укажите город вручную',
      showRefresh: false,
    };
  }

  if (draft.locationMode === 'auto' && autoLocationStatus === 'unavailable') {
    return {
      title: 'Не удалось определить местоположение',
      subtitle: 'Определено автоматически',
      showRefresh: true,
    };
  }

  if (draft.locationMode === 'auto' && draft.autoLocation) {
    return {
      title: formatCityLabel(draft.autoLocation),
      subtitle: 'Определено автоматически',
      showRefresh: true,
    };
  }

  if (draft.locationMode === 'manual' && draft.manualLocation) {
    return {
      title: formatCityLabel(draft.manualLocation),
      subtitle: 'Указано вручную',
      showRefresh: false,
    };
  }

  return {
    title: 'Выберите местоположение',
    subtitle: draft.locationMode === 'auto' ? 'Определено автоматически' : 'Указано вручную',
    showRefresh: false,
  };
}

function LocationSummaryRow({
  summary,
  onPress,
  onRefresh,
}: {
  summary: LocationSummary;
  onPress: () => void;
  onRefresh: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.locationRow, pressed && styles.pressed]}>
      <View style={styles.locationRowText}>
        <ThemedText style={styles.locationTitle} numberOfLines={1}>
          {summary.title}
        </ThemedText>
        {summary.subtitle ? (
          <ThemedText themeColor="textSecondary" style={styles.locationSubtitle} numberOfLines={2}>
            {summary.subtitle}
          </ThemedText>
        ) : null}
      </View>

      {summary.showRefresh ? (
        <Pressable
          onPress={onRefresh}
          hitSlop={8}
          style={({ pressed }) => [styles.locationRefreshButton, pressed && styles.pressed]}>
          <SymbolView
            name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
            size={16}
            tintColor={Colors.light.textSecondary}
          />
        </Pressable>
      ) : null}

      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        size={14}
        tintColor={Colors.light.textSecondary}
      />
    </Pressable>
  );
}

function LocationModeToggle({
  mode,
  onSelectAuto,
  onSelectManual,
}: {
  mode: LocationMode;
  onSelectAuto: () => void;
  onSelectManual: () => void;
}) {
  return (
    <View style={styles.modeToggleRow}>
      <Pressable
        onPress={onSelectAuto}
        style={({ pressed }) => [
          styles.modeToggleButton,
          mode === 'auto' && styles.modeToggleButtonSelected,
          pressed && styles.pressed,
        ]}>
        <ThemedText
          style={[styles.modeToggleText, mode === 'auto' && styles.modeToggleTextSelected]}
          numberOfLines={2}>
          Определять автоматически
        </ThemedText>
      </Pressable>

      <Pressable
        onPress={onSelectManual}
        style={({ pressed }) => [
          styles.modeToggleButton,
          mode === 'manual' && styles.modeToggleButtonSelected,
          pressed && styles.pressed,
        ]}>
        <ThemedText
          style={[styles.modeToggleText, mode === 'manual' && styles.modeToggleTextSelected]}
          numberOfLines={2}>
          Указать вручную
        </ThemedText>
      </Pressable>
    </View>
  );
}

function AutoCityBlock({
  draft,
  status,
  onRefresh,
}: {
  draft: BodyParameters;
  status: AutoLocationStatus;
  onRefresh: () => void;
}) {
  const isLoading = status === 'loading';
  const cityLabel = draft.autoLocation
    ? formatCityLabel(draft.autoLocation)
    : 'Местоположение пока не определено';

  const actionLabel = isLoading
    ? 'Определяем местоположение...'
    : draft.autoLocation
      ? 'Обновить местоположение'
      : 'Определить местоположение';

  return (
    <View style={styles.cityBlock}>
      <SectionTitle>ГОРОД</SectionTitle>

      <ThemedText
        style={[
          styles.cityValue,
          !draft.autoLocation && styles.cityValuePlaceholder,
          isLoading && !draft.autoLocation && styles.cityValueLoading,
        ]}>
        {isLoading && !draft.autoLocation ? 'Определяем местоположение...' : cityLabel}
      </ThemedText>

      {status === 'permission_denied' ? (
        <ThemedText themeColor="textSecondary" style={styles.cityHint}>
          Нет доступа к геолокации. Разрешите доступ в настройках устройства или укажите город
          вручную.
        </ThemedText>
      ) : null}

      {status === 'unavailable' ? (
        <ThemedText themeColor="textSecondary" style={styles.cityHint}>
          Не удалось определить местоположение
        </ThemedText>
      ) : null}

      <Pressable
        onPress={onRefresh}
        disabled={isLoading}
        style={({ pressed }) => [
          styles.locationActionButton,
          isLoading && styles.locationActionButtonDisabled,
          pressed && !isLoading && styles.pressed,
        ]}>
        {isLoading ? (
          <View style={styles.locationActionLoading}>
            <ActivityIndicator size="small" color={Colors.light.text} />
            <ThemedText style={styles.locationActionButtonText}>{actionLabel}</ThemedText>
          </View>
        ) : (
          <ThemedText style={styles.locationActionButtonText}>{actionLabel}</ThemedText>
        )}
      </Pressable>
    </View>
  );
}

function ManualCityBlock({
  cityQuery,
  selectedLocation,
  onChangeText,
  onSelect,
}: {
  cityQuery: string;
  selectedLocation: ManualLocation | null;
  onChangeText: (text: string) => void;
  onSelect: (location: ManualLocation) => void;
}) {
  return (
    <View style={styles.cityBlock}>
      <SectionTitle>ГОРОД</SectionTitle>
      <CityAutocompleteField
        value={cityQuery}
        selectedLocation={selectedLocation}
        onChangeText={onChangeText}
        onSelect={onSelect}
        showFieldLabel={false}
      />
    </View>
  );
}

function LocationScreenContent({
  draft,
  autoLocationStatus,
  cityQuery,
  onSelectAuto,
  onSelectManual,
  onCityQueryChange,
  onCitySelect,
  onRefreshAuto,
}: {
  draft: BodyParameters;
  autoLocationStatus: AutoLocationStatus;
  cityQuery: string;
  onSelectAuto: () => void;
  onSelectManual: () => void;
  onCityQueryChange: (text: string) => void;
  onCitySelect: (location: ManualLocation) => void;
  onRefreshAuto: () => void;
}) {
  return (
    <View style={styles.formContent}>
      <LocationModeToggle
        mode={draft.locationMode}
        onSelectAuto={onSelectAuto}
        onSelectManual={onSelectManual}
      />

      {draft.locationMode === 'auto' ? (
        <AutoCityBlock draft={draft} status={autoLocationStatus} onRefresh={onRefreshAuto} />
      ) : (
        <ManualCityBlock
          cityQuery={cityQuery}
          selectedLocation={draft.manualLocation}
          onChangeText={onCityQueryChange}
          onSelect={onCitySelect}
        />
      )}
    </View>
  );
}

function CityAutocompleteField({
  value,
  selectedLocation,
  onChangeText,
  onSelect,
  showFieldLabel = true,
}: {
  value: string;
  selectedLocation: ManualLocation | null;
  onChangeText: (text: string) => void;
  onSelect: (location: ManualLocation) => void;
  showFieldLabel?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<ManualLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const trimmedValue = value.trim();
    const selectedLabel = selectedLocation ? formatCityLabel(selectedLocation) : null;

    if (trimmedValue.length < CITY_SEARCH_MIN_QUERY_LENGTH || value === selectedLabel) {
      setSuggestions([]);
      setIsSearching(false);
      setSearchError(null);
      setShowSuggestions(false);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const results = await searchCities(trimmedValue, controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        setSuggestions(results);
        setShowSuggestions(true);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        void error;
        setSuggestions([]);
        setSearchError('Не удалось загрузить города');
        setShowSuggestions(true);
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, selectedLocation]);

  const handleSelect = (location: ManualLocation) => {
    onSelect(location);
    setSuggestions([]);
    setSearchError(null);
    setShowSuggestions(false);
  };

  const showResultsPanel =
    showSuggestions &&
    (isSearching || searchError !== null || suggestions.length > 0 || value.trim().length >= CITY_SEARCH_MIN_QUERY_LENGTH);

  return (
    <View style={styles.cityField}>
      {showFieldLabel ? <ThemedText style={styles.fieldLabel}>Город</ThemedText> : null}
      <TextInput
        value={value}
        onChangeText={(text) => {
          onChangeText(text);
          setShowSuggestions(true);
        }}
        onFocus={() => {
          if (value.trim().length >= CITY_SEARCH_MIN_QUERY_LENGTH) {
            setShowSuggestions(true);
          }
        }}
        style={styles.textInput}
        placeholder="Начните вводить город"
        placeholderTextColor={Colors.light.textSecondary}
        autoCorrect={false}
        autoCapitalize="words"
      />

      {showResultsPanel && (
        <View style={styles.suggestionsList}>
          {isSearching ? (
            <View style={styles.suggestionStatus}>
              <ActivityIndicator size="small" color={Colors.light.textSecondary} />
            </View>
          ) : searchError ? (
            <ThemedText themeColor="textSecondary" style={styles.suggestionMessage}>
              {searchError}
            </ThemedText>
          ) : suggestions.length > 0 ? (
            suggestions.map((location, index) => (
              <Pressable
                key={`${location.name}-${location.country}-${location.latitude}-${location.longitude}`}
                onPress={() => handleSelect(location)}
                style={({ pressed }) => [
                  styles.suggestionItem,
                  index === suggestions.length - 1 && styles.suggestionItemLast,
                  pressed && styles.pressed,
                ]}>
                <ThemedText style={styles.suggestionText}>{formatCityLabel(location)}</ThemedText>
              </Pressable>
            ))
          ) : (
            <ThemedText themeColor="textSecondary" style={styles.suggestionMessage}>
              Ничего не найдено
            </ThemedText>
          )}
        </View>
      )}
    </View>
  );
}

export default function BodyParametersSheet({
  visible,
  onClose,
  initialScreen = 'main',
}: BodyParametersSheetProps) {
  const insets = useSafeAreaInsets();
  const {
    setBodyParameters,
    isHydrated,
    locationMode,
    manualLocation,
    autoLocation,
    heightCm,
    topSize,
    bottomSize,
    shoeSize,
    fitPreference,
    weatherSensitivity,
  } = useBodyParameters();
  const { queuePreferencesSync } = usePreferencesSync();

  const { status: autoLocationStatus, detectLocation, resetStatus, syncStatusFromLocation } =
    useUserLocation();

  const [draft, setDraft] = useState<BodyParameters>({
    locationMode,
    manualLocation,
    autoLocation,
    heightCm,
    topSize,
    bottomSize,
    shoeSize,
    fitPreference,
    weatherSensitivity,
  });

  const [cityQuery, setCityQuery] = useState(
    manualLocation ? formatCityLabel(manualLocation) : '',
  );
  const [sheetScreen, setSheetScreen] = useState<SheetScreen>('main');
  const wasVisibleRef = useRef(false);

  const translateY = useSharedValue(0);
  const locationSummary = getLocationSummary(draft, autoLocationStatus);

  const handleDismiss = useCallback(() => {
    translateY.value = 0;
    onClose();
  }, [onClose, translateY]);

  const panGesture = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 72 || event.velocityY > 450) {
        runOnJS(handleDismiss)();
        return;
      }

      translateY.value = withSpring(0);
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    if (!visible) {
      translateY.value = 0;
      resetStatus();
      setSheetScreen('main');
      wasVisibleRef.current = false;
      return;
    }

    if (!isHydrated || wasVisibleRef.current) {
      return;
    }

    wasVisibleRef.current = true;
    setSheetScreen(initialScreen);
    setDraft({
      locationMode,
      manualLocation,
      autoLocation,
      heightCm,
      topSize,
      bottomSize,
      shoeSize,
      fitPreference,
      weatherSensitivity,
    });
    setCityQuery(manualLocation ? formatCityLabel(manualLocation) : '');
    syncStatusFromLocation(autoLocation);
  }, [
    visible,
    isHydrated,
    locationMode,
    manualLocation,
    autoLocation,
    heightCm,
    topSize,
    bottomSize,
    shoeSize,
    fitPreference,
    weatherSensitivity,
    translateY,
    resetStatus,
    syncStatusFromLocation,
    initialScreen,
  ]);

  const runAutoDetect = useCallback(async () => {
    const location = await detectLocation();

    if (location) {
      setDraft((current) => ({ ...current, autoLocation: location }));
    }
  }, [detectLocation]);

  const handleSelectAutoMode = () => {
    setDraft((current) => ({ ...current, locationMode: 'auto' }));
  };

  const handleSelectManualMode = () => {
    setDraft((current) => ({ ...current, locationMode: 'manual' }));
  };

  const handleCityQueryChange = (text: string) => {
    setCityQuery(text);
    setDraft((current) => ({
      ...current,
      manualLocation:
        current.manualLocation && formatCityLabel(current.manualLocation) === text
          ? current.manualLocation
          : null,
    }));
  };

  const handleCitySelect = (location: ManualLocation) => {
    setCityQuery(formatCityLabel(location));
    setDraft((current) => ({
      ...current,
      locationMode: 'manual',
      manualLocation: location,
    }));
  };

  const handleSave = () => {
    setBodyParameters(draft);
    queuePreferencesSync();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.overlay}>
        <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
          <GestureDetector gesture={panGesture}>
            <View style={styles.sheetGrabber}>
              <View style={styles.dragArea}>
                <View style={styles.dragHandle} />
              </View>

              <View style={styles.sheetHeader}>
                {sheetScreen === 'location' ? (
                  <Pressable
                    onPress={() => setSheetScreen('main')}
                    hitSlop={8}
                    style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                    <SymbolView
                      name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
                      size={18}
                      tintColor={Colors.light.text}
                    />
                  </Pressable>
                ) : null}

                <ThemedText style={styles.sheetTitle}>
                  {sheetScreen === 'main' ? 'Мои параметры' : 'Местоположение'}
                </ThemedText>

                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                  <ThemedText style={styles.closeButtonText}>×</ThemedText>
                </Pressable>
              </View>
            </View>
          </GestureDetector>

          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
            <Animated.ScrollView
              style={styles.scrollView}
              contentContainerStyle={[
                styles.scrollContent,
                sheetScreen === 'main' && styles.scrollContentWithFooter,
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              {sheetScreen === 'main' ? (
                <View style={styles.formContent}>
                  <View style={styles.section}>
                    <SectionTitle>МЕСТОПОЛОЖЕНИЕ</SectionTitle>
                    <LocationSummaryRow
                      summary={locationSummary}
                      onPress={() => setSheetScreen('location')}
                      onRefresh={() => {
                        void runAutoDetect();
                      }}
                    />
                  </View>

                  <View style={styles.section}>
                    <SectionTitle>РАЗМЕРЫ</SectionTitle>

                    <View style={styles.field}>
                      <ThemedText style={styles.fieldLabel}>Рост</ThemedText>
                      <View style={styles.heightRow}>
                        <TextInput
                          value={draft.heightCm}
                          onChangeText={(heightCm) =>
                            setDraft((current) => ({ ...current, heightCm }))
                          }
                          style={[styles.textInput, styles.heightInput]}
                          placeholder="170"
                          placeholderTextColor={Colors.light.textSecondary}
                          keyboardType="number-pad"
                          maxLength={3}
                        />
                        <ThemedText style={styles.unitLabel}>см</ThemedText>
                      </View>
                    </View>

                    <View style={styles.subsection}>
                      <ThemedText style={styles.fieldLabel}>Размер верха</ThemedText>
                      <View style={styles.chipGroup}>
                        {CLOTHING_SIZES.map((size) => (
                          <Chip
                            key={size}
                            label={size}
                            selected={draft.topSize === size}
                            onPress={() =>
                              setDraft((current) => ({ ...current, topSize: size as ClothingSize }))
                            }
                          />
                        ))}
                      </View>
                    </View>

                    <View style={styles.subsection}>
                      <ThemedText style={styles.fieldLabel}>Размер низа</ThemedText>
                      <View style={styles.chipGroup}>
                        {CLOTHING_SIZES.map((size) => (
                          <Chip
                            key={size}
                            label={size}
                            selected={draft.bottomSize === size}
                            onPress={() =>
                              setDraft((current) => ({
                                ...current,
                                bottomSize: size as ClothingSize,
                              }))
                            }
                          />
                        ))}
                      </View>
                    </View>

                    <View style={styles.subsection}>
                      <ThemedText style={styles.fieldLabel}>Размер обуви</ThemedText>
                      <View style={styles.chipGroup}>
                        {SHOE_SIZES_EU.map((size) => (
                          <Chip
                            key={size}
                            label={size}
                            selected={draft.shoeSize === size}
                            onPress={() =>
                              setDraft((current) => ({ ...current, shoeSize: size as ShoeSizeEu }))
                            }
                          />
                        ))}
                      </View>
                    </View>
                  </View>

                  <View style={styles.section}>
                    <SectionTitle>ПРЕДПОЧТЕНИЕ ПО ПОСАДКЕ</SectionTitle>
                    <View style={styles.chipGroup}>
                      {FIT_PREFERENCES.map((option) => (
                        <Chip
                          key={option}
                          label={option}
                          selected={draft.fitPreference === option}
                          onPress={() =>
                            setDraft((current) => ({
                              ...current,
                              fitPreference: option as FitPreference,
                            }))
                          }
                        />
                      ))}
                    </View>
                  </View>

                  <View style={styles.section}>
                    <SectionTitle>КАК ВЫ ОЩУЩАЕТЕ ПОГОДУ?</SectionTitle>
                    <ThemedText themeColor="textSecondary" style={styles.hintText}>
                      Это поможет точнее подбирать одежду под температуру.
                    </ThemedText>
                    <View style={styles.chipGroup}>
                      {WEATHER_SENSITIVITIES.map((option) => (
                        <Chip
                          key={option}
                          label={option}
                          selected={draft.weatherSensitivity === option}
                          onPress={() =>
                            setDraft((current) => ({
                              ...current,
                              weatherSensitivity: option as WeatherSensitivity,
                            }))
                          }
                        />
                      ))}
                    </View>
                  </View>
                </View>
              ) : (
                <LocationScreenContent
                  draft={draft}
                  autoLocationStatus={autoLocationStatus}
                  cityQuery={cityQuery}
                  onSelectAuto={handleSelectAutoMode}
                  onSelectManual={handleSelectManualMode}
                  onCityQueryChange={handleCityQueryChange}
                  onCitySelect={handleCitySelect}
                  onRefreshAuto={() => {
                    void runAutoDetect();
                  }}
                />
              )}
            </Animated.ScrollView>

            {sheetScreen === 'main' ? (
              <View
                style={[
                  styles.sheetFooter,
                  { paddingBottom: Math.max(insets.bottom, Spacing.three) },
                ]}>
                <Pressable
                  onPress={handleSave}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                  <ThemedText style={styles.primaryButtonText}>Сохранить</ThemedText>
                </Pressable>
              </View>
            ) : null}
          </KeyboardAvoidingView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    height: '80%',
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.four,
  },
  sheetGrabber: {
    alignSelf: 'stretch',
  },
  dragArea: {
    alignItems: 'center',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.backgroundSelected,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: -Spacing.one,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: -Spacing.one,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 28,
    lineHeight: 28,
    color: Colors.light.textSecondary,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.four,
  },
  scrollContentWithFooter: {
    paddingBottom: Spacing.three,
  },
  sheetFooter: {
    paddingTop: Spacing.two,
  },
  formContent: {
    gap: Spacing.five,
  },
  section: {
    gap: Spacing.three,
  },
  subsection: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: Colors.light.text,
  },
  hintText: {
    fontSize: 14,
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
  },
  locationRowText: {
    flex: 1,
    gap: Spacing.half,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
    color: Colors.light.text,
  },
  locationSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  locationRefreshButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  modeToggleButton: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.backgroundSelected,
    backgroundColor: Colors.light.backgroundElement,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggleButtonSelected: {
    backgroundColor: Colors.light.text,
    borderColor: Colors.light.text,
  },
  modeToggleText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    color: Colors.light.text,
    textAlign: 'center',
  },
  modeToggleTextSelected: {
    color: Colors.light.background,
  },
  cityBlock: {
    gap: Spacing.three,
  },
  cityValue: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
    color: Colors.light.text,
  },
  cityValuePlaceholder: {
    color: Colors.light.textSecondary,
    fontWeight: '400',
  },
  cityValueLoading: {
    color: Colors.light.textSecondary,
    fontWeight: '400',
  },
  cityHint: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: -Spacing.one,
  },
  locationActionButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.backgroundSelected,
    borderRadius: 14,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.background,
  },
  locationActionButtonDisabled: {
    opacity: 0.7,
  },
  locationActionButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.text,
  },
  locationActionLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  field: {
    gap: Spacing.one,
  },
  cityField: {
    gap: Spacing.one,
    zIndex: 2,
  },
  suggestionsList: {
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.backgroundSelected,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    minHeight: 44,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.backgroundSelected,
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    fontSize: 15,
    lineHeight: 20,
    color: Colors.light.text,
  },
  suggestionMessage: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 14,
    lineHeight: 20,
  },
  suggestionStatus: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'flex-start',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  textInput: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    color: Colors.light.text,
  },
  heightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  heightInput: {
    flex: 1,
    maxWidth: 120,
  },
  unitLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.textSecondary,
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
  primaryButton: {
    backgroundColor: Colors.light.text,
    paddingVertical: Spacing.three + 2,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.light.background,
    fontSize: 17,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
