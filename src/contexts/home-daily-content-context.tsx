import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useBodyParameters } from '@/contexts/body-parameters-context';
import { useAccount } from '@/contexts/account-context';
import { useOutfits } from '@/contexts/outfits-context';
import { useStylistPreferences } from '@/contexts/stylist-preferences-context';
import type { StylistPreferences } from '@/constants/stylist-preferences';
import { useWearHistory } from '@/contexts/wear-history-context';
import { useWardrobe } from '@/contexts/wardrobe-context';
import { useHomeDailyContent } from '@/hooks/use-home-daily-content';
import { getActiveLocation } from '@/utils/get-active-location';
import { getLocalCalendarDateKeyForTimezone } from '@/utils/wear-date';

const HomeDailyContentContext = createContext<ReturnType<typeof useHomeDailyContent> | null>(null);

export function HomeDailyContentProvider({ children }: { children: ReactNode }) {
  const { isServerAccount } = useAccount();
  const { items, isHydrated: wardrobeReady } = useWardrobe();
  const { savedOutfits, isHydrated: outfitsReady } = useOutfits();
  const stylistPreferencesValue = useStylistPreferences();
  const {
    isHydrated: stylistReady,
    considerWeather,
    styleExperiment,
    wardrobeMode,
    avoidRepeatedOutfits,
    dailyStylistEnabled,
    dailyStylistTime,
    timezone,
  } = stylistPreferencesValue;
  const stylistPrefs: StylistPreferences = {
    considerWeather,
    styleExperiment,
    wardrobeMode,
    avoidRepeatedOutfits,
    dailyStylistEnabled,
    dailyStylistTime,
    timezone,
  };
  const {
    weatherSensitivity,
    fitPreference,
    locationMode,
    manualLocation,
    autoLocation,
    isHydrated: bodyReady,
  } = useBodyParameters();
  const { wearEvents, getItemWearCount, getItemLastWornAt, isHydrated: wearHistoryReady } =
    useWearHistory();
  const requestLocation = useMemo(
    () => getActiveLocation({ locationMode, manualLocation, autoLocation }),
    [locationMode, manualLocation, autoLocation],
  );
  const wearHistory = useMemo(
    () => ({ getItemWearCount, getItemLastWornAt }),
    [getItemWearCount, getItemLastWornAt],
  );
  const userParameters = useMemo(
    () => ({ fitPreference, weatherSensitivity }),
    [fitPreference, weatherSensitivity],
  );
  const localDate = useMemo(
    () => getLocalCalendarDateKeyForTimezone(timezone),
    [timezone],
  );

  const value = useHomeDailyContent({
    isHydrated: wardrobeReady && outfitsReady && stylistReady && bodyReady && wearHistoryReady,
    isServerAccount,
    localDate,
    items,
    savedOutfits,
    wearEvents,
    stylistPreferences: stylistPrefs,
    userParameters,
    requestLocation,
    wearHistory,
  });

  return <HomeDailyContentContext.Provider value={value}>{children}</HomeDailyContentContext.Provider>;
}

export function useHomeDailyData() {
  const value = useContext(HomeDailyContentContext);
  if (!value) throw new Error('useHomeDailyData must be used within HomeDailyContentProvider');
  return value;
}
