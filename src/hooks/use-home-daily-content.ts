import { describeOutfitItems } from '@/utils/outfit-description';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FitPreference, WeatherSensitivity } from '@/constants/body-parameters';
import type { SavedOutfit } from '@/constants/saved-outfit';
import type { StylistPreferences } from '@/constants/stylist-preferences';
import type { WearEvent } from '@/constants/wear-event';
import {
  isHomeOutfitCacheFresh,
  loadHomeOutfitCache,
  saveHomeOutfitCache,
  type CachedHomeOutfitEntry,
} from '@/storage/home-outfit-cache';
import { isWeatherCacheFresh, loadWeatherCache, saveWeatherCache } from '@/storage/weather-cache';
import { fetchCurrentWeather } from '@/services/current-weather';
import { suggestOutfits, type OutfitSuggestion, type OutfitWeather, type SuggestOutfitsLocation } from '@/services/outfit-suggestions';
import type { WardrobeItem } from '@/contexts/wardrobe-context';
import { buildStylistContext } from '@/utils/build-stylist-context';
import { buildHomeInputSignature } from '@/utils/home-input-signature';
import { buildLocationKey } from '@/utils/home-location-key';
import { replaceOutfitItem } from '@/utils/outfit-item-replacement';
import type { WearHistoryLookup } from '@/utils/build-wardrobe-suggestion-payload';

type Params = {
  isHydrated: boolean;
  items: WardrobeItem[];
  savedOutfits: SavedOutfit[];
  wearEvents: WearEvent[];
  stylistPreferences: StylistPreferences;
  userParameters: {
    fitPreference: FitPreference | null;
    weatherSensitivity: WeatherSensitivity | null;
  };
  requestLocation: SuggestOutfitsLocation | null;
  wearHistory: WearHistoryLookup;
};
type LoadState = 'idle' | 'loading' | 'success' | 'error' | 'empty-wardrobe';

const CACHE_SIGNATURE_PREFIX = 'v3';

export function useHomeDailyContent(params: Params) {
  const { isHydrated, items, savedOutfits, wearEvents, stylistPreferences, userParameters, requestLocation, wearHistory } = params;
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [homeOutfit, setHomeOutfit] = useState<OutfitSuggestion | null>(null);
  const [weather, setWeather] = useState<OutfitWeather | null>(null);
  const [isWeatherLoading, setWeatherLoading] = useState(false);
  const [isRegenerating, setRegenerating] = useState(false);
  const [regenerateError, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const currentOutfit = useRef<OutfitSuggestion | null>(null);
  const currentEntry = useRef<CachedHomeOutfitEntry | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const writes = useRef(Promise.resolve());
  const persist = useCallback((entry: CachedHomeOutfitEntry) => {
    writes.current = writes.current.catch(() => {}).then(() => saveHomeOutfitCache(entry));
  }, []);

  const buildSignature = useCallback(
    (weather: OutfitWeather | null) =>
      buildHomeInputSignature({
        wardrobe: items,
        stylistPreferences,
        userParameters,
        location: requestLocation,
        weather,
        wearHistory,
        savedOutfits,
        wearEvents,
      }),
    [items, requestLocation, savedOutfits, stylistPreferences, userParameters, wearEvents, wearHistory],
  );

  const syncKey = buildSignature(null);
  const cacheHydratedRef = useRef(false);

  useEffect(() => {
    if (!isHydrated || cacheHydratedRef.current) {
      return;
    }

    cacheHydratedRef.current = true;

    void (async () => {
      const [cachedOutfit, cachedWeather] = await Promise.all([
        loadHomeOutfitCache(),
        loadWeatherCache(),
      ]);

      if (cachedOutfit && isHomeOutfitCacheFresh(cachedOutfit.fetchedAt)) {
        currentOutfit.current = cachedOutfit.outfit;
        currentEntry.current = cachedOutfit;
        setHomeOutfit(cachedOutfit.outfit);
        setLoadState('success');
      }

      if (cachedWeather && isWeatherCacheFresh(cachedWeather.fetchedAt)) {
        setWeather(cachedWeather.data);
      }
    })();
  }, [isHydrated]);

  const sync = useCallback(async (manual = false) => {
    const p = paramsRef.current;
    if (!p.isHydrated || busy.current) return;
    busy.current = true;
    const run = ++generation.current;
    const active = () => run === generation.current;
    const key = buildHomeInputSignature({
      wardrobe: p.items,
      stylistPreferences: p.stylistPreferences,
      userParameters: p.userParameters,
      location: p.requestLocation,
      weather: null,
      wearHistory: p.wearHistory,
      savedOutfits: p.savedOutfits,
      wearEvents: p.wearEvents,
    });
    const locationKey = p.requestLocation ? buildLocationKey(p.requestLocation) : null;
    const previous = manual ? currentOutfit.current : null;
    setError(null);
    setRegenerating(true);
    let weatherTask: Promise<void> | undefined;

    try {
      if (p.items.length < 2) {
        setLoadState('empty-wardrobe');
        return;
      }

      const [cached, legacyWeather] = await Promise.all([loadHomeOutfitCache(), loadWeatherCache()]);
      if (!active()) return;

      const freshWeatherEntry =
        legacyWeather &&
        legacyWeather.locationKey === locationKey &&
        isWeatherCacheFresh(legacyWeather.fetchedAt)
          ? legacyWeather
          : null;
      const legacyWeatherData = freshWeatherEntry?.data ?? null;
      const signatureWithWeather = buildHomeInputSignature({
        wardrobe: p.items,
        stylistPreferences: p.stylistPreferences,
        userParameters: p.userParameters,
        location: p.requestLocation,
        weather: legacyWeatherData,
        wearHistory: p.wearHistory,
        savedOutfits: p.savedOutfits,
        wearEvents: p.wearEvents,
      });
      const cachedSignature = `${CACHE_SIGNATURE_PREFIX}:${key}`;
      const cachedUsable =
        cached &&
        isHomeOutfitCacheFresh(cached.fetchedAt) &&
        (cached.inputSignature === cachedSignature ||
          cached.inputSignature === signatureWithWeather ||
          cached.inputSignature === `v2:${key}`) &&
        cached.outfit.itemIds.length >= 2 &&
        cached.outfit.itemIds.every((id) => p.items.some((item) => item.id === id));
      const weatherCacheReady =
        !p.stylistPreferences.considerWeather ||
        !p.requestLocation ||
        Boolean(freshWeatherEntry);

      if (!manual && cachedUsable && cached && weatherCacheReady) {
        currentOutfit.current = cached.outfit;
        currentEntry.current = { ...cached, inputSignature: cachedSignature };
        setHomeOutfit(cached.outfit);
        setWeather(legacyWeatherData);
        setLoadState('success');
        setWeatherLoading(false);
        setRegenerating(false);
        return;
      }

      setWeatherLoading(p.stylistPreferences.considerWeather && !!p.requestLocation);
      if (!manual) {
        currentOutfit.current = null;
        currentEntry.current = null;
        setHomeOutfit(null);
        setWeather(null);
      }
      setLoadState(previous ? 'success' : 'loading');

      weatherTask = (async () => {
        if (!p.stylistPreferences.considerWeather || !p.requestLocation || !locationKey) {
          setWeatherLoading(false);
          return;
        }

        try {
          const cachedWeather = freshWeatherEntry ?? legacyWeather;

          if (
            cachedWeather?.locationKey === locationKey &&
            isWeatherCacheFresh(cachedWeather.fetchedAt)
          ) {
            if (!active()) return;
            setWeather(cachedWeather.data);
            return;
          }

          if (cachedWeather?.locationKey === locationKey) {
            setWeather(cachedWeather.data);
          }

          const fresh = await fetchCurrentWeather(p.requestLocation);
          if (!active()) return;

          if (fresh) {
            setWeather(fresh);
            writes.current = writes.current
              .catch(() => {})
              .then(() =>
                saveWeatherCache({ data: fresh, locationKey, fetchedAt: Date.now() }),
              );
          }
        } catch {
          // A weather failure must not prevent the outfit or startup animation from finishing.
        } finally {
          if (active()) setWeatherLoading(false);
        }
      })();

      const fallback = previous ?? (cachedUsable && cached ? cached.outfit : null);

      if (fallback) {
        currentOutfit.current = fallback;
        if (!previous && cached) currentEntry.current = { ...cached, inputSignature: cachedSignature };
        setHomeOutfit(fallback);
        setLoadState('success');
      }

      if (!manual && cachedUsable && cached) {
        void weatherTask;
        return;
      }

      try {
        const stylistContext = buildStylistContext({
          wardrobe: p.items,
          savedOutfits: p.savedOutfits,
          wearEvents: p.wearEvents,
          wearHistory: p.wearHistory,
          stylistPreferences: p.stylistPreferences,
          userParameters: p.userParameters,
          location: p.requestLocation,
        });
        const result = await suggestOutfits({ stylistContext });
        if (!active()) return;
        const outfit = result.outfits.find(
          (candidate) =>
            candidate.itemIds.length >= 2 &&
            new Set(candidate.itemIds).size === candidate.itemIds.length &&
            candidate.itemIds.every((id) => p.items.some((item) => item.id === id)),
        );
        if (!outfit) throw new Error('No usable outfit');
        const entry = { outfit, inputSignature: cachedSignature, fetchedAt: Date.now() };
        currentOutfit.current = outfit;
        currentEntry.current = entry;
        setHomeOutfit(outfit);
        setLoadState('success');
        persist(entry);
      } catch {
        if (!active()) return;
        setLoadState(fallback ? 'success' : 'error');
        setError(
          fallback
            ? 'Не удалось обновить образ. Показываем предыдущий вариант.'
            : 'Не удалось подобрать образ. Попробуй ещё раз.',
        );
      }
    } finally {
      if (active()) {
        busy.current = false;
        setRegenerating(false);
      }
      if (weatherTask) {
        void weatherTask;
      }
    }
  }, [persist]);

  useEffect(() => {
    void sync();
    return () => {
      generation.current += 1;
      busy.current = false;
    };
  }, [isHydrated, syncKey, sync]);

  const replaceItem = useCallback(
    (targetId: string, replacementId: string): boolean => {
      const outfit = currentOutfit.current;
      if (busy.current || !outfit || !currentEntry.current) return false;
      const ids = replaceOutfitItem(outfit.itemIds, targetId, replacementId, paramsRef.current.items);
      if (!ids) return false;
      const next = {
        ...outfit,
        title: 'Твой вариант на сегодня',
        itemIds: ids,
        description: describeOutfitItems(
          paramsRef.current.items.filter((item) => ids.includes(item.id)),
        ),
      };
      const entry = { ...currentEntry.current, outfit: next };
      currentOutfit.current = next;
      currentEntry.current = entry;
      setHomeOutfit(next);
      setError(null);
      persist(entry);
      return true;
    },
    [persist],
  );

  const regenerateOutfit = useCallback(() => {
    void sync(true);
  }, [sync]);

  return {
    loadState,
    homeOutfit,
    weather,
    isWeatherLoading,
    isRegenerating,
    regenerateError,
    regenerateOutfit,
    replaceItem,
  };
}
