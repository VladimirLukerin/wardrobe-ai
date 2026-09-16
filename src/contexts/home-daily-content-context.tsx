import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useBodyParameters } from '@/contexts/body-parameters-context';
import { useStylistPreferences } from '@/contexts/stylist-preferences-context';
import { useWardrobe } from '@/contexts/wardrobe-context';
import { useHomeDailyContent } from '@/hooks/use-home-daily-content';
import { getActiveLocation } from '@/utils/get-active-location';

const HomeDailyContentContext = createContext<ReturnType<typeof useHomeDailyContent> | null>(null);

export function HomeDailyContentProvider({ children }: { children: ReactNode }) {
  const { items, isHydrated: wardrobeReady } = useWardrobe();
  const { styleExperiment, considerWeather, isHydrated: stylistReady } = useStylistPreferences();
  const { weatherSensitivity, locationMode, manualLocation, autoLocation, isHydrated: bodyReady } = useBodyParameters();
  const requestLocation = useMemo(() => getActiveLocation({ locationMode, manualLocation, autoLocation }), [locationMode, manualLocation, autoLocation]);
  const value = useHomeDailyContent({ isHydrated: wardrobeReady && stylistReady && bodyReady, items, styleExperiment, considerWeather, weatherSensitivity, requestLocation });
  return <HomeDailyContentContext.Provider value={value}>{children}</HomeDailyContentContext.Provider>;
}

export function useHomeDailyData() {
  const value = useContext(HomeDailyContentContext);
  if (!value) throw new Error('useHomeDailyData must be used within HomeDailyContentProvider');
  return value;
}
