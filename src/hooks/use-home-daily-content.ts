import { describeOutfitItems } from '@/utils/outfit-description';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WeatherSensitivity } from '@/constants/body-parameters';
import type { StyleExperiment } from '@/constants/stylist-preferences';
import { loadHomeOutfitCache, saveHomeOutfitCache, type CachedHomeOutfitEntry } from '@/storage/home-outfit-cache';
import { loadWeatherCache, saveWeatherCache } from '@/storage/weather-cache';
import { fetchCurrentWeather } from '@/services/current-weather';
import { suggestOutfits, type OutfitSuggestion, type OutfitWeather, type SuggestOutfitsLocation } from '@/services/outfit-suggestions';
import type { WardrobeItem } from '@/contexts/wardrobe-context';
import { buildHomeInputSignature } from '@/utils/home-input-signature';
import { buildLocationKey } from '@/utils/home-location-key';
import { replaceOutfitItem } from '@/utils/outfit-item-replacement';

type Params = {
  isHydrated: boolean;
  items: WardrobeItem[];
  styleExperiment: StyleExperiment;
  considerWeather: boolean;
  weatherSensitivity: WeatherSensitivity | null;
  requestLocation: SuggestOutfitsLocation | null;
};
type LoadState = 'idle' | 'loading' | 'success' | 'error' | 'empty-wardrobe';

export function useHomeDailyContent(params: Params) {
  const { isHydrated, items, styleExperiment, considerWeather, weatherSensitivity, requestLocation } = params;
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
  // Serialize cache writes, including replacements, so rapid actions cannot restore an older outfit.
  const writes = useRef(Promise.resolve());
  const persist = useCallback((entry: CachedHomeOutfitEntry) => {
    writes.current = writes.current.catch(() => {}).then(() => saveHomeOutfitCache(entry));
  }, []);
  const syncKey = buildHomeInputSignature({ wardrobe: items, styleExperiment, considerWeather, weatherSensitivity, location: requestLocation, weather: null });

  const sync = useCallback(async (manual = false) => {
    const p = paramsRef.current;
    if (!p.isHydrated || busy.current) return;
    busy.current = true;
    const run = ++generation.current;
    const active = () => run === generation.current;
    const key = buildHomeInputSignature({ wardrobe: p.items, styleExperiment: p.styleExperiment, considerWeather: p.considerWeather, weatherSensitivity: p.weatherSensitivity, location: p.requestLocation, weather: null });
    const locationKey = p.requestLocation ? buildLocationKey(p.requestLocation) : null;
    const previous = manual ? currentOutfit.current : null;
    setError(null);
    setRegenerating(true);
    setWeatherLoading(p.considerWeather && !!p.requestLocation);
    if (!manual) {
      currentOutfit.current = null;
      currentEntry.current = null;
      setHomeOutfit(null);
      setWeather(null);
    }
    setLoadState(p.items.length < 2 ? 'empty-wardrobe' : previous ? 'success' : 'loading');

    const weatherTask = (async () => {
      if (!p.considerWeather || !p.requestLocation || !locationKey) { setWeatherLoading(false); return; }
      try {
        const cached = await loadWeatherCache();
        if (!active()) return;
        if (cached?.locationKey === locationKey) setWeather(cached.data);
        const fresh = await fetchCurrentWeather(p.requestLocation);
        if (!active()) return;
        if (fresh) {
          setWeather(fresh);
          // Cache writes share the same ordering as outfit writes across location changes.
          writes.current = writes.current.catch(() => {}).then(() => saveWeatherCache({ data: fresh, locationKey, fetchedAt: Date.now() }));
        }
      } catch {
        // A weather failure must not prevent the outfit or startup animation from finishing.
      } finally { if (active()) setWeatherLoading(false); }
    })();

    try {
      if (p.items.length < 2) return;
      const [cached, legacyWeather] = await Promise.all([loadHomeOutfitCache(), loadWeatherCache()]);
      if (!active()) return;
      // v2 signatures deliberately exclude volatile weather readings; data is refreshed on each launch.
      const legacySignature = buildHomeInputSignature({ wardrobe: p.items, styleExperiment: p.styleExperiment, considerWeather: p.considerWeather, weatherSensitivity: p.weatherSensitivity, location: p.requestLocation, weather: legacyWeather?.locationKey === locationKey ? legacyWeather?.data ?? null : null });
      const cachedUsable = cached && (cached.inputSignature === `v2:${key}` || cached.inputSignature === legacySignature) && cached.outfit.itemIds.length >= 2 && cached.outfit.itemIds.every((id) => p.items.some((item) => item.id === id));
      const fallback = previous ?? (cachedUsable && cached ? cached.outfit : null);
      if (fallback) {
        currentOutfit.current = fallback;
        if (!previous && cached) currentEntry.current = { ...cached, inputSignature: `v2:${key}` };
        setHomeOutfit(fallback);
        setLoadState('success');
      }
      try {
        const result = await suggestOutfits({ wardrobe: p.items, styleExperiment: p.styleExperiment, considerWeather: p.considerWeather, location: p.requestLocation, weatherSensitivity: p.weatherSensitivity });
        if (!active()) return;
        const outfit = result.outfits.find((candidate) => candidate.itemIds.length >= 2 && new Set(candidate.itemIds).size === candidate.itemIds.length && candidate.itemIds.every((id) => p.items.some((item) => item.id === id)));
        if (!outfit) throw new Error('No usable outfit');
        const entry = { outfit, inputSignature: `v2:${key}`, fetchedAt: Date.now() };
        currentOutfit.current = outfit;
        currentEntry.current = entry;
        setHomeOutfit(outfit);
        setLoadState('success');
        persist(entry);
      } catch {
        if (!active()) return;
        setLoadState(fallback ? 'success' : 'error');
        setError(fallback ? 'Не удалось обновить образ. Показываем предыдущий вариант.' : 'Не удалось подобрать образ. Попробуй ещё раз.');
      }
    } finally {
      if (active()) { busy.current = false; setRegenerating(false); }
      // Weather has its own loading state and does not hold the outfit controls or launch animation.
      void weatherTask;
    }
  }, [persist]);

  useEffect(() => {
    void sync();
    return () => { generation.current += 1; busy.current = false; };
  }, [isHydrated, syncKey, sync]);

  const replaceItem = useCallback((targetId: string, replacementId: string): boolean => {
    const outfit = currentOutfit.current;
    if (busy.current || !outfit || !currentEntry.current) return false;
    const ids = replaceOutfitItem(outfit.itemIds, targetId, replacementId, paramsRef.current.items);
    if (!ids) return false;
    const next = { ...outfit, title: 'Твой вариант на сегодня', itemIds: ids, description: describeOutfitItems(paramsRef.current.items.filter((item) => ids.includes(item.id))) };
    const entry = { ...currentEntry.current, outfit: next };
    currentOutfit.current = next;
    currentEntry.current = entry;
    setHomeOutfit(next);
    setError(null);
    persist(entry);
    return true;
  }, [persist]);

  const regenerateOutfit = useCallback(() => { void sync(true); }, [sync]);
  return { loadState, homeOutfit, weather, isWeatherLoading, isRegenerating, regenerateError, regenerateOutfit, replaceItem };
}
