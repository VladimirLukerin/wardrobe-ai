import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { NetworkErrorState } from '@/components/network-error-state';
import { PrikinHandwritten } from '@/components/prikin/prikin-brand-header';
import { PrikinColors, PrikinSpacing } from '@/constants/prikin-tokens';
import type { CurrentWeatherErrorCode } from '@/services/current-weather';
import type { OutfitWeather } from '@/services/outfit-suggestions';
import { NETWORK_ERROR_HINT, NETWORK_ERROR_TITLE } from '@/utils/network-error';
import { formatWeatherTemperature } from '@/utils/weather-code';
import { getWeatherSymbolName } from '@/utils/weather-symbol';

type HomeWeatherHeaderProps = {
  locationName: string;
  considerWeather: boolean;
  weather: OutfitWeather | null;
  isLoading: boolean;
  error: CurrentWeatherErrorCode | null;
  onRetry: () => void;
  onLocationPress?: () => void;
};

export function HomeWeatherHeader({
  locationName,
  considerWeather,
  weather,
  isLoading,
  error,
  onRetry,
  onLocationPress,
}: HomeWeatherHeaderProps) {
  const locationLabel = `${locationName} ›`;
  const symbol = weather ? getWeatherSymbolName(weather.weatherCode) : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.mainRow}>
        <View style={styles.leftColumn}>
          {onLocationPress ? (
            <Pressable
              onPress={onLocationPress}
              accessibilityRole="button"
              accessibilityLabel={`Город: ${locationName}`}
              style={({ pressed }) => [styles.locationRow, pressed && styles.pressed]}>
              <Text style={styles.location}>{locationLabel}</Text>
            </Pressable>
          ) : (
            <Text style={styles.location}>{locationLabel}</Text>
          )}

          {considerWeather ? (
            weather && symbol ? (
              <View style={styles.weatherRow}>
                <SymbolView
                  name={{
                    ios: symbol.ios as 'cloud.fill',
                    android: symbol.android as 'cloud',
                    web: symbol.web as 'cloud',
                  }}
                  size={22}
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
            ) : isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={PrikinColors.textSecondary} />
                <Text style={styles.loadingText}>Погода…</Text>
              </View>
            ) : error ? (
              <NetworkErrorState
                compact
                title={error === 'network' ? NETWORK_ERROR_TITLE : 'Не удалось загрузить погоду'}
                hint={error === 'network' ? NETWORK_ERROR_HINT : 'Попробуйте ещё раз.'}
                onRetry={onRetry}
                style={styles.weatherError}
              />
            ) : null
          ) : null}
        </View>

        <PrikinHandwritten style={styles.handwritten}>Удачного дня</PrikinHandwritten>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 56,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: PrikinSpacing.homeCardGap,
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
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: PrikinColors.textPrimary,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  tempColumn: {
    gap: 0,
    flexShrink: 1,
  },
  temperature: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 26,
    color: PrikinColors.textPrimary,
  },
  feelsLike: {
    fontSize: 12,
    lineHeight: 16,
    color: PrikinColors.textSecondary,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 28,
  },
  loadingText: {
    fontSize: 13,
    lineHeight: 18,
    color: PrikinColors.textSecondary,
  },
  weatherError: {
    marginTop: 4,
    alignSelf: 'stretch',
  },
  handwritten: {
    flexShrink: 0,
    maxWidth: 108,
    textAlign: 'right',
    transform: [{ rotate: '-10deg' }],
    marginTop: 4,
  },
  pressed: {
    opacity: 0.85,
  },
});
