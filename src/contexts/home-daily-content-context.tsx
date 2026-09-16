import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useBodyParameters } from '@/contexts/body-parameters-context';
import { useOutfits } from '@/contexts/outfits-context';
import { useStylistPreferences } from '@/contexts/stylist-preferences-context';
import { useWearHistory } from '@/contexts/wear-history-context';
import { useWardrobe } from '@/contexts/wardrobe-context';
import { useHomeDailyContent } from '@/hooks/use-home-daily-content';
import { getActiveLocation } from '@/utils/get-active-location';

const HomeDailyContentContext = createContext<ReturnType<typeof useHomeDailyContent> | null>(null);

export function HomeDailyContentProvider({ children }: { children: ReactNode }) {
  const { items, isHydrated: wardrobeReady } = useWardrobe();
  const { savedOutfits, isHydrated: outfitsReady } = useOutfits();
  const {
    isHydrated: stylistReady,
    considerWeather,
    styleExperiment,
    wardrobeMode,
    avoidRepeatedOutfits,
  } = useStylistPreferences();
  const stylistPrefs = { considerWeather, styleExperiment, wardrobeMode, avoidRepeatedOutfits };
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

  const value = useHomeDailyContent({
    isHydrated: wardrobeReady && outfitsReady && stylistReady && bodyReady && wearHistoryReady,
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
