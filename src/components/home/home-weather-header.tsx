import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { NetworkErrorState } from '@/components/network-error-state';
import { PrikinHandwritten } from '@/components/prikin/prikin-brand-header';
import { PrikinHomeLayout } from '@/constants/prikin-home-tokens';
import { PrikinColors } from '@/constants/prikin-tokens';
import type { CurrentWeatherErrorCode } from '@/services/current-weather';
import type { OutfitWeather } from '@/services/outfit-suggestions';
import { NETWORK_ERROR_HINT, NETWORK_ERROR_TITLE } from '@/utils/network-error';
import { formatWeatherTemperature } from '@/utils/weather-code';
import { getWeatherSymbolName } from '@/utils/weather-symbol';

type HomeWeatherHeaderProps = {
  locationName: string | null;
  isLocationPending: boolean;
  considerWeather: boolean;
  weather: OutfitWeather | null;
  isLoading: boolean;
  error: CurrentWeatherErrorCode | null;
  onRetry: () => void;
  onLocationPress?: () => void;
};

export function HomeWeatherHeader({
  locationName,
  isLocationPending,
  considerWeather,
  weather,
  isLoading,
  error,
  onRetry,
  onLocationPress,
}: HomeWeatherHeaderProps) {
  const symbol = weather ? getWeatherSymbolName(weather.weatherCode) : null;
  const showWeatherLoading =
    considerWeather && !weather && (isLoading || (Boolean(locationName) && !error));
  const showWeatherError = considerWeather && !weather && Boolean(error) && Boolean(locationName);

  const locationLabel = locationName ? `${locationName} ›` : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.mainRow}>
        <View style={styles.leftColumn}>
          {locationLabel ? (
            onLocationPress ? (
              <Pressable
                onPress={onLocationPress}
                accessibilityRole="button"
                accessibilityLabel={`Город: ${locationName}`}
                style={({ pressed }) => [styles.locationRow, pressed && styles.pressed]}>
                <Text style={styles.location}>{locationLabel}</Text>
              </Pressable>
            ) : (
              <Text style={styles.location}>{locationLabel}</Text>
            )
          ) : isLocationPending ? (
            <View style={styles.locationPendingRow}>
              <ActivityIndicator size="small" color={PrikinColors.textSecondary} />
              <Text style={styles.locationPending}>Определяем город…</Text>
            </View>
          ) : (
            <Text style={styles.locationMuted}>Город не указан</Text>
          )}

          {considerWeather && weather && symbol ? (
            <View style={styles.weatherRow}>
              <SymbolView
                name={{
                  ios: symbol.ios as 'cloud.fill',
                  android: symbol.android as 'cloud',
                  web: symbol.web as 'cloud',
                }}
                size={24}
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
            <View style={styles.weatherPlaceholder}>
              <ActivityIndicator size="small" color={PrikinColors.textSecondary} />
              <Text style={styles.loadingText}>Погода…</Text>
            </View>
          ) : showWeatherError ? (
            <NetworkErrorState
              compact
              title={error === 'network' ? NETWORK_ERROR_TITLE : 'Не удалось загрузить погоду'}
              hint={error === 'network' ? NETWORK_ERROR_HINT : 'Попробуйте ещё раз.'}
              onRetry={onRetry}
              style={styles.weatherError}
            />
          ) : considerWeather ? (
            <View style={styles.weatherPlaceholder} />
          ) : null}
        </View>

        <PrikinHandwritten style={styles.handwritten}>Удачного дня</PrikinHandwritten>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 72,
    marginTop: PrikinHomeLayout.logoToLocationGap,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  leftColumn: {
    flex: 1,
    gap: 4,
    minWidth: 0,
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
    minHeight: PrikinHomeLayout.locationLineHeight,
  },
  locationPending: {
    fontSize: 14,
    lineHeight: PrikinHomeLayout.locationLineHeight,
    color: PrikinColors.textSecondary,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 2,
  },
  tempColumn: {
    gap: 0,
    flexShrink: 1,
    paddingTop: 2,
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
  weatherPlaceholder: {
    minHeight: 36,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: PrikinHomeLayout.feelsLikeFontSize,
    lineHeight: PrikinHomeLayout.feelsLikeLineHeight,
    color: PrikinColors.textSecondary,
  },
  weatherError: {
    marginTop: 2,
    alignSelf: 'stretch',
  },
  handwritten: {
    flexShrink: 0,
    maxWidth: 112,
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'right',
    transform: [{ rotate: '-10deg' }],
    marginTop: 8,
  },
  pressed: {
    opacity: 0.85,
  },
});
