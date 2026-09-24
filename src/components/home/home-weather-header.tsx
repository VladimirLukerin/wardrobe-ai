import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { HomeDayMessage } from '@/components/home/home-day-message';
import { PrikinHomeLayout } from '@/constants/prikin-home-tokens';
import { PrikinColors } from '@/constants/prikin-tokens';
import type { HomeLocationPresentationPhase } from '@/hooks/use-home-location-presentation';
import type { CurrentWeatherErrorCode } from '@/services/current-weather';
import type { OutfitWeather } from '@/services/outfit-suggestions';
import { formatWeatherTemperature } from '@/utils/weather-code';
import { getWeatherSymbolName } from '@/utils/weather-symbol';

type HomeWeatherHeaderProps = {
  locationName: string | null;
  locationPhase: HomeLocationPresentationPhase;
  isDetectingLocation: boolean;
  considerWeather: boolean;
  weather: OutfitWeather | null;
  isWeatherLoading: boolean;
  weatherError: CurrentWeatherErrorCode | null;
  onRetryWeather: () => void;
  onRequestLocationAccess: () => void;
  onRetryLocation: () => void;
  onLocationPress?: () => void;
};

export function HomeWeatherHeader({
  locationName,
  locationPhase,
  isDetectingLocation,
  considerWeather,
  weather,
  isWeatherLoading,
  weatherError,
  onRetryWeather,
  onRequestLocationAccess,
  onRetryLocation,
  onLocationPress,
}: HomeWeatherHeaderProps) {
  const symbol = weather ? getWeatherSymbolName(weather.weatherCode) : null;
  const showWeatherBlock = locationPhase === 'ready' && considerWeather;
  const showWeatherLoading =
    showWeatherBlock && !weather && isWeatherLoading && Boolean(locationName) && !weatherError;
  const showWeatherError =
    showWeatherBlock &&
    Boolean(weatherError) &&
    Boolean(locationName) &&
    !weather &&
    !isWeatherLoading;
  const showWeatherData = showWeatherBlock && weather && symbol;

  const locationLabel = locationName ? `${locationName} ›` : null;

  const renderCityRow = (pressable: boolean) => {
    if (!locationLabel) {
      return null;
    }

    const content = (
      <>
        <SymbolView
          name={{
            ios: 'location',
            android: 'location_on',
            web: 'location_on',
          }}
          size={14}
          tintColor={PrikinColors.textPrimary}
        />
        <Text style={styles.location}>{locationLabel}</Text>
      </>
    );

    if (pressable && onLocationPress) {
      return (
        <Pressable
          onPress={onLocationPress}
          accessibilityRole="button"
          accessibilityLabel={`Город: ${locationName}`}
          style={({ pressed }) => [styles.cityRow, pressed && styles.pressed]}>
          {content}
        </Pressable>
      );
    }

    return <View style={styles.cityRow}>{content}</View>;
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.mainRow}>
        <View style={styles.leftColumn}>
          {locationPhase === 'need_permission' ? (
            <Pressable
              onPress={onLocationPress ?? onRequestLocationAccess}
              accessibilityRole="button"
              accessibilityLabel="Разрешить геолокацию"
              style={({ pressed }) => [styles.permissionCta, pressed && styles.pressed]}>
              <SymbolView
                name={{
                  ios: 'location',
                  android: 'location_on',
                  web: 'location_on',
                }}
                size={14}
                tintColor={PrikinColors.textPrimary}
              />
              <View style={styles.permissionCopy}>
                <Text style={styles.permissionTitle}>Разрешить геолокацию</Text>
                <Text style={styles.permissionHint}>
                  Чтобы показывать погоду для вашего города
                </Text>
              </View>
            </Pressable>
          ) : isDetectingLocation ? (
            <View style={styles.locationPendingRow}>
              <ActivityIndicator size="small" color={PrikinColors.textSecondary} />
              <Text style={styles.locationPending}>Определяем город…</Text>
            </View>
          ) : locationLabel ? (
            renderCityRow(Boolean(onLocationPress))
          ) : locationPhase === 'location_unavailable' ? (
            <Pressable
              onPress={onRetryLocation}
              accessibilityRole="button"
              accessibilityLabel="Повторить определение города"
              style={({ pressed }) => [styles.compactRetry, pressed && styles.pressed]}>
              <Text style={styles.compactRetryTitle}>Не удалось определить город</Text>
              <Text style={styles.compactRetryAction}>Повторить</Text>
            </Pressable>
          ) : locationPhase === 'ready' ? (
            <Text style={styles.locationMuted}>Город не указан</Text>
          ) : null}

          {showWeatherData ? (
            <View style={styles.weatherRow}>
              <SymbolView
                name={{
                  ios: symbol.ios as 'cloud.fill',
                  android: symbol.android as 'cloud',
                  web: symbol.web as 'cloud',
                }}
                size={PrikinHomeLayout.weatherSymbolSize}
                tintColor={PrikinColors.textPrimary}
              />
              <View style={styles.tempColumn}>
                <Text style={styles.temperature}>
                  {formatWeatherTemperature(weather.temperatureC)}
                </Text>
                <Text style={styles.feelsLike}>
                  Ощущается как {formatWeatherTemperature(weather.apparentTemperatureC)}
                </Text>
              </View>
            </View>
          ) : showWeatherLoading ? (
            <View style={styles.weatherLoadingRow}>
              <ActivityIndicator size="small" color={PrikinColors.textSecondary} />
              <Text style={styles.loadingText}>Погода…</Text>
            </View>
          ) : showWeatherError ? (
            <Pressable
              onPress={onRetryWeather}
              accessibilityRole="button"
              accessibilityLabel="Повторить загрузку погоды"
              style={({ pressed }) => [styles.compactRetry, pressed && styles.pressed]}>
              <Text style={styles.compactRetryTitle}>Не удалось обновить погоду</Text>
              <Text style={styles.compactRetryAction}>Повторить</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.rightColumn}>
          <HomeDayMessage />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: PrikinHomeLayout.logoToLocationGap,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  leftColumn: {
    flex: PrikinHomeLayout.headerLeftColumnFlex,
    gap: PrikinHomeLayout.headerWeatherBlockGap,
    minWidth: 0,
  },
  rightColumn: {
    flex: PrikinHomeLayout.headerRightColumnFlex,
    minWidth: 100,
    maxWidth: 148,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 0,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  locationRow: {
    alignSelf: 'flex-start',
  },
  location: {
    fontSize: PrikinHomeLayout.locationFontSize,
    fontWeight: '600',
    lineHeight: PrikinHomeLayout.locationLineHeight,
    color: PrikinColors.textPrimary,
  },
  locationMuted: {
    fontSize: PrikinHomeLayout.locationFontSize,
    fontWeight: '500',
    lineHeight: PrikinHomeLayout.locationLineHeight,
    color: PrikinColors.textSecondary,
  },
  locationPendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationPending: {
    fontSize: 14,
    lineHeight: PrikinHomeLayout.locationLineHeight,
    color: PrikinColors.textSecondary,
  },
  permissionCta: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    alignSelf: 'flex-start',
  },
  permissionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  permissionTitle: {
    fontSize: PrikinHomeLayout.permissionTitleFontSize,
    fontWeight: '600',
    lineHeight: PrikinHomeLayout.permissionTitleLineHeight,
    color: PrikinColors.textPrimary,
  },
  permissionHint: {
    fontSize: PrikinHomeLayout.permissionHintFontSize,
    lineHeight: PrikinHomeLayout.permissionHintLineHeight,
    color: PrikinColors.textSecondary,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 0,
  },
  tempColumn: {
    gap: 0,
    flexShrink: 1,
    paddingTop: 1,
  },
  temperature: {
    fontSize: PrikinHomeLayout.temperatureFontSize,
    fontWeight: '600',
    lineHeight: PrikinHomeLayout.temperatureLineHeight,
    color: PrikinColors.textPrimary,
  },
  feelsLike: {
    fontSize: PrikinHomeLayout.feelsLikeFontSize,
    lineHeight: PrikinHomeLayout.feelsLikeLineHeight,
    color: PrikinColors.textSecondary,
  },
  weatherLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  loadingText: {
    fontSize: PrikinHomeLayout.feelsLikeFontSize,
    lineHeight: PrikinHomeLayout.feelsLikeLineHeight,
    color: PrikinColors.textSecondary,
  },
  compactRetry: {
    alignSelf: 'flex-start',
    gap: 2,
    marginTop: 2,
  },
  compactRetryTitle: {
    fontSize: PrikinHomeLayout.feelsLikeFontSize,
    lineHeight: PrikinHomeLayout.feelsLikeLineHeight,
    color: PrikinColors.textSecondary,
  },
  compactRetryAction: {
    fontSize: PrikinHomeLayout.locationFontSize,
    fontWeight: '600',
    lineHeight: PrikinHomeLayout.locationLineHeight,
    color: PrikinColors.textPrimary,
  },
  pressed: {
    opacity: 0.85,
  },
});
