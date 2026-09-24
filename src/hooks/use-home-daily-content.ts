import { describeOutfitItems } from '@/utils/outfit-description';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FitPreference, WeatherSensitivity } from '@/constants/body-parameters';
import type { OutfitFeedback, OutfitFeedbackReason } from '@/constants/outfit-feedback';
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
import {
  CurrentWeatherError,
  fetchCurrentWeather,
  type CurrentWeatherErrorCode,
} from '@/services/current-weather';
import {
  OutfitSuggestionError,
  suggestOutfits,
  type OutfitSuggestion,
  type OutfitWeather,
  type SuggestOutfitsLocation,
} from '@/services/outfit-suggestions';
import {
  fetchTodayDailyOutfit,
  regenerateDailyOutfit,
  type DailyOutfit,
} from '@/services/paired-outfits-storage';
import { AccountApiError } from '@/services/account';
import { isDailyStylistDisabledError, isUnexpectedDailyMutationError } from '@/utils/daily-outfit-errors';
import {
  AI_PROVIDER_RATE_LIMIT_USER_MESSAGE,
  AI_RATE_LIMIT_USER_MESSAGE,
  getAiRateLimitUserMessage,
  isAiProviderRateLimitedError,
  isAnyAiRateLimitError,
} from '@/utils/ai-rate-limit-error';
import { shouldAttemptDailyCreateOrRegenerate } from '@/utils/home-daily-preferences-sync';
import {
  getDailySuggestFallbackSkipReason,
  shouldUseDailySuggestFallback,
} from '@/utils/daily-ai-fallback-policy';
import type { PreferencesSyncStatus } from '@/contexts/preferences-sync-context';
import { useAppConfig } from '@/contexts/app-config-context';
import { fetchOutfitFeedback, saveOutfitFeedback } from '@/services/outfit-feedback';
import { getAuthToken } from '@/storage/auth-token-storage';
import {
  buildDailyRecommendationKey,
  createHomeSuggestRecommendationKey,
  resolveCachedRecommendationKey,
} from '@/utils/build-recommendation-key';
import { isRetryableNetworkError, NETWORK_ERROR_TITLE } from '@/utils/network-error';
import type { WardrobeItem } from '@/contexts/wardrobe-context';
import { buildStylistContext } from '@/utils/build-stylist-context';
import { buildHomeInputSignature } from '@/utils/home-input-signature';
import { buildLocationKey } from '@/utils/home-location-key';
import { buildGuestHomeCta, buildGuestWeatherAdvice } from '@/utils/guest-weather-advisor';
import { replaceOutfitItem } from '@/utils/outfit-item-replacement';
import type { WearHistoryLookup } from '@/utils/build-wardrobe-suggestion-payload';

type Params = {
  isHydrated: boolean;
  isServerAccount: boolean;
  isGuestUser: boolean;
  accountScope: string;
  localDate: string;
  preferencesSyncStatus: PreferencesSyncStatus;
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
type LoadState = 'idle' | 'loading' | 'success' | 'error' | 'empty-wardrobe' | 'guest-weather';
export type HomeContentErrorKind = 'network' | 'server' | 'rate_limited' | 'provider_rate_limited';

const CACHE_SIGNATURE_PREFIX = 'v3';

function devDailyHomeLog(message: string): void {
  if (__DEV__) {
    console.log(message);
  }
}

function buildDailyCacheSignature(localDate: string): string {
  return `daily:${localDate}`;
}

function sanitizeDailyOutfitItemIds(itemIds: string[], wardrobe: WardrobeItem[]): string[] | null {
  const validIds = [...new Set(itemIds.filter((id) => wardrobe.some((item) => item.id === id)))];
  return validIds.length >= 2 ? validIds : null;
}

function dailyOutfitToSuggestion(
  daily: DailyOutfit,
  itemIds: string[],
  wardrobe: WardrobeItem[],
): OutfitSuggestion {
  const sanitized = itemIds.length !== daily.itemIds.length;

  return {
    id: daily.id,
    title: 'Твой вариант на сегодня',
    itemIds,
    description: sanitized
      ? describeOutfitItems(wardrobe.filter((item) => itemIds.includes(item.id)))
      : daily.description,
  };
}

type ApplyServerDailyParams = {
  daily: DailyOutfit;
  sanitizedItemIds: string[];
  wardrobe: WardrobeItem[];
  localDate: string;
  legacyWeatherData: OutfitWeather | null;
  persist: (entry: CachedHomeOutfitEntry) => void;
  runWeatherTask: () => void;
  setHomeOutfit: (outfit: OutfitSuggestion | null) => void;
  setWeather: (weather: OutfitWeather | null) => void;
  setLoadState: (state: LoadState) => void;
  setWeatherLoading: (loading: boolean) => void;
  considerWeather: boolean;
  hasRequestLocation: boolean;
  currentOutfit: { current: OutfitSuggestion | null };
  currentEntry: { current: CachedHomeOutfitEntry | null };
  setRecommendationKey: (key: string | null) => void;
};

function applyServerDailyOutfit(params: ApplyServerDailyParams): OutfitSuggestion {
  const outfit = dailyOutfitToSuggestion(params.daily, params.sanitizedItemIds, params.wardrobe);
  const recommendationKey = buildDailyRecommendationKey(params.localDate, params.daily.id);
  const entry = {
    outfit,
    inputSignature: buildDailyCacheSignature(params.localDate),
    recommendationKey,
    fetchedAt: Date.now(),
  };

  params.currentOutfit.current = outfit;
  params.currentEntry.current = entry;
  params.setHomeOutfit(outfit);
  params.setRecommendationKey(recommendationKey);
  params.setWeather(params.daily.weather ?? params.legacyWeatherData);
  params.setLoadState('success');
  params.setWeatherLoading(params.considerWeather && params.hasRequestLocation);
  params.persist(entry);
  params.runWeatherTask();

  return outfit;
}

export function useHomeDailyContent(params: Params) {
  const {
    isHydrated,
    isServerAccount,
    isGuestUser,
    accountScope,
    localDate,
    preferencesSyncStatus,
    items,
    savedOutfits,
    wearEvents,
    stylistPreferences,
    userParameters,
    requestLocation,
    wearHistory,
  } = params;
  const { config: appConfig } = useAppConfig();
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [homeOutfit, setHomeOutfit] = useState<OutfitSuggestion | null>(null);
  const [weather, setWeather] = useState<OutfitWeather | null>(null);
  const [isWeatherLoading, setWeatherLoading] = useState(false);
  const [isRegenerating, setRegenerating] = useState(false);
  const [regenerateError, setError] = useState<string | null>(null);
  const [outfitErrorKind, setOutfitErrorKind] = useState<HomeContentErrorKind | null>(null);
  const [weatherError, setWeatherError] = useState<CurrentWeatherErrorCode | null>(null);
  const [recommendationKey, setRecommendationKey] = useState<string | null>(null);
  const [guestWeatherAdvice, setGuestWeatherAdvice] = useState<string | null>(null);
  const [guestHomeCta, setGuestHomeCta] = useState<string | null>(null);
  const [outfitFeedback, setOutfitFeedback] = useState<OutfitFeedback | null>(null);
  const [isFeedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackLoadError, setFeedbackLoadError] = useState(false);
  const [isFeedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitError, setFeedbackSubmitError] = useState(false);
  const pendingFeedbackRating = useRef<'like' | 'dislike' | null>(null);
  const pendingFeedbackReason = useRef<OutfitFeedbackReason | null | undefined>(undefined);
  const pendingFeedbackTargetItemId = useRef<string | undefined>(undefined);
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
        setRecommendationKey(resolveCachedRecommendationKey(cachedOutfit, localDate));
        setLoadState('success');
      }

      if (cachedWeather && isWeatherCacheFresh(cachedWeather.fetchedAt)) {
        setWeather(cachedWeather.data);
      }
    })();
  }, [isHydrated]);

  const sync = useCallback(async (manual = false) => {
    const p = paramsRef.current;
    const dailyStylistEnabled =
      p.stylistPreferences.dailyStylistEnabled && appConfig.dailyStylistEnabled;
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
    setOutfitErrorKind(null);
    setRegenerating(true);
    let weatherTask: Promise<void> | undefined;
    let rateLimitBlocked = false;
    let dailyProviderAttempted = false;

    const markRateLimitBlocked = (error: unknown): boolean => {
      if (error instanceof OutfitSuggestionError) {
        if (error.code === 'provider_rate_limited') {
          rateLimitBlocked = true;
          setOutfitErrorKind('provider_rate_limited');
          setLoadState(previous ? 'success' : 'error');
          setError(error.message || AI_PROVIDER_RATE_LIMIT_USER_MESSAGE);
          return true;
        }

        if (error.code === 'rate_limited') {
          rateLimitBlocked = true;
          setOutfitErrorKind('rate_limited');
          setLoadState(previous ? 'success' : 'error');
          setError(error.message || AI_RATE_LIMIT_USER_MESSAGE);
          return true;
        }
      }

      if (isAnyAiRateLimitError(error)) {
        rateLimitBlocked = true;
        setOutfitErrorKind(isAiProviderRateLimitedError(error) ? 'provider_rate_limited' : 'rate_limited');
        setLoadState(previous ? 'success' : 'error');
        setError(getAiRateLimitUserMessage(error));
        return true;
      }

      return false;
    };

    try {
      if (p.isGuestUser) {
        setHomeOutfit(null);
        setRecommendationKey(null);
        setGuestHomeCta(buildGuestHomeCta(p.items.length));
        setLoadState(p.items.length < 2 ? 'empty-wardrobe' : 'guest-weather');
        setWeatherLoading(p.stylistPreferences.considerWeather && !!p.requestLocation);

        weatherTask = (async () => {
          if (!p.stylistPreferences.considerWeather || !p.requestLocation || !locationKey) {
            setGuestWeatherAdvice(buildGuestWeatherAdvice({}));
            setWeatherLoading(false);
            return;
          }

          try {
            setWeatherError(null);

            const cachedWeather = await loadWeatherCache();
            const freshWeatherEntry =
              cachedWeather &&
              cachedWeather.locationKey === locationKey &&
              isWeatherCacheFresh(cachedWeather.fetchedAt)
                ? cachedWeather
                : null;
            let resolvedWeather = freshWeatherEntry?.data ?? null;

            if (!resolvedWeather) {
              resolvedWeather = await fetchCurrentWeather(p.requestLocation);
            }

            if (!active()) {
              return;
            }

            if (resolvedWeather) {
              setWeather(resolvedWeather);
              writes.current = writes.current
                .catch(() => {})
                .then(() =>
                  saveWeatherCache({ data: resolvedWeather!, locationKey, fetchedAt: Date.now() }),
                );
            }

            setGuestWeatherAdvice(buildGuestWeatherAdvice(resolvedWeather ?? {}));
          } catch (weatherFailure) {
            if (!active()) {
              return;
            }

            if (weatherFailure instanceof CurrentWeatherError) {
              setWeatherError(weatherFailure.code);
            } else {
              console.error('Unexpected guest weather error:', weatherFailure);
              setWeatherError('server');
            }

            setGuestWeatherAdvice(buildGuestWeatherAdvice({}));
          } finally {
            if (active()) {
              setWeatherLoading(false);
            }
          }
        })();

        await weatherTask;
        return;
      }

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
      const dailyCacheSignature = buildDailyCacheSignature(p.localDate);
      const cachedUsable =
        cached &&
        isHomeOutfitCacheFresh(cached.fetchedAt) &&
        (cached.inputSignature === cachedSignature ||
          cached.inputSignature === signatureWithWeather ||
          cached.inputSignature === `v2:${key}`) &&
        cached.outfit.itemIds.length >= 2 &&
        cached.outfit.itemIds.every((id) => p.items.some((item) => item.id === id));
      const dailyCacheUsable =
        p.isServerAccount &&
        cached &&
        isHomeOutfitCacheFresh(cached.fetchedAt) &&
        cached.inputSignature === dailyCacheSignature &&
        cached.outfit.itemIds.length >= 2 &&
        cached.outfit.itemIds.every((id) => p.items.some((item) => item.id === id));
      const weatherCacheReady =
        !p.stylistPreferences.considerWeather ||
        !p.requestLocation ||
        Boolean(freshWeatherEntry);

      const canMutateDaily = shouldAttemptDailyCreateOrRegenerate(
        dailyStylistEnabled,
        p.isServerAccount,
        p.preferencesSyncStatus,
      );

      const runWeatherTask = () => {
        weatherTask = (async () => {
          if (!p.stylistPreferences.considerWeather || !p.requestLocation || !locationKey) {
            setWeatherLoading(false);
            return;
          }

          try {
            setWeatherError(null);

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
          } catch (weatherFailure) {
            if (!active()) return;

            if (weatherFailure instanceof CurrentWeatherError) {
              setWeatherError(weatherFailure.code);
            } else {
              console.error('Unexpected weather error:', weatherFailure);
              setWeatherError('server');
            }
          } finally {
            if (active()) setWeatherLoading(false);
          }
        })();
      };

      if (manual && p.isServerAccount && p.localDate && canMutateDaily) {
        try {
          const token = await getAuthToken();

          if (!token) {
            throw new Error('Auth token missing');
          }

          devDailyHomeLog('[DAILY HOME] manual regenerate');
          dailyProviderAttempted = true;
          const daily = await regenerateDailyOutfit(token, p.localDate, p.requestLocation, {
            accountScope: p.accountScope,
            manual: true,
          });
          if (!active()) return;

          const sanitizedItemIds = sanitizeDailyOutfitItemIds(daily.itemIds, p.items);

          if (!sanitizedItemIds) {
            throw new Error('No usable outfit');
          }

          applyServerDailyOutfit({
            daily,
            sanitizedItemIds,
            wardrobe: p.items,
            localDate: p.localDate,
            legacyWeatherData,
            persist,
            runWeatherTask,
            setHomeOutfit,
            setWeather,
            setLoadState,
            setWeatherLoading,
            considerWeather: p.stylistPreferences.considerWeather,
            hasRequestLocation: Boolean(p.requestLocation),
            currentOutfit,
            currentEntry,
            setRecommendationKey,
          });
          devDailyHomeLog('[DAILY HOME] daily replaced');
          return;
        } catch (manualRegenError) {
          if (!active()) return;

          if (markRateLimitBlocked(manualRegenError)) {
            return;
          }

          const kind: HomeContentErrorKind = isRetryableNetworkError(manualRegenError)
            ? 'network'
            : 'server';

          if (
            isUnexpectedDailyMutationError(manualRegenError) &&
            !(manualRegenError instanceof Error && manualRegenError.message === 'No usable outfit')
          ) {
            console.error('Unexpected manual daily regeneration error:', manualRegenError);
          }

          setOutfitErrorKind(kind);
          setLoadState(previous ? 'success' : 'error');
          setError(
            kind === 'network'
              ? NETWORK_ERROR_TITLE
              : manualRegenError instanceof AccountApiError ||
                  manualRegenError instanceof Error
                ? manualRegenError.message
                : 'Не удалось обновить образ. Попробуй ещё раз.',
          );
          return;
        }
      }

      if (!manual && p.isServerAccount && p.localDate) {
        devDailyHomeLog(`[DAILY HOME] fetch date=${p.localDate}`);

        try {
          const token = await getAuthToken();

          if (token) {
            const daily = await fetchTodayDailyOutfit(token, p.localDate);
            if (!active()) return;

            if (daily) {
              const sanitizedItemIds = sanitizeDailyOutfitItemIds(daily.itemIds, p.items);
              const applyParams = {
                daily,
                sanitizedItemIds: sanitizedItemIds ?? daily.itemIds,
                wardrobe: p.items,
                localDate: p.localDate,
                legacyWeatherData,
                persist,
                runWeatherTask,
                setHomeOutfit,
                setWeather,
                setLoadState,
                setWeatherLoading,
                considerWeather: p.stylistPreferences.considerWeather,
                hasRequestLocation: Boolean(p.requestLocation),
                currentOutfit,
                currentEntry,
                setRecommendationKey,
              };

              if (sanitizedItemIds && !daily.isStale) {
                devDailyHomeLog('[DAILY HOME] server hit');
                applyServerDailyOutfit({ ...applyParams, sanitizedItemIds });
                devDailyHomeLog('[DAILY HOME] suggest skipped');
                return;
              }

              if (sanitizedItemIds && daily.isStale && !dailyStylistEnabled) {
                devDailyHomeLog('[DAILY HOME] server hit');
                applyServerDailyOutfit({ ...applyParams, sanitizedItemIds });
                devDailyHomeLog('[DAILY HOME] suggest skipped');
                return;
              }

              if (sanitizedItemIds && daily.isStale && dailyStylistEnabled) {
                devDailyHomeLog('[DAILY HOME] server hit');
                applyServerDailyOutfit({ ...applyParams, sanitizedItemIds });
                devDailyHomeLog('[DAILY HOME] stale interim');

                if (canMutateDaily) {
                  try {
                    devDailyHomeLog('[DAILY HOME] stale regenerate');
                    dailyProviderAttempted = true;
                    const regenerated = await regenerateDailyOutfit(
                      token,
                      p.localDate,
                      p.requestLocation,
                      { accountScope: p.accountScope },
                    );
                    if (!active()) return;

                    const regeneratedItemIds = sanitizeDailyOutfitItemIds(
                      regenerated.itemIds,
                      p.items,
                    );

                    if (regeneratedItemIds) {
                      applyServerDailyOutfit({
                        ...applyParams,
                        daily: regenerated,
                        sanitizedItemIds: regeneratedItemIds,
                      });
                      devDailyHomeLog('[DAILY HOME] daily replaced');
                      devDailyHomeLog('[DAILY HOME] suggest skipped');
                      return;
                    }
                  } catch (staleRegenError) {
        if (markRateLimitBlocked(staleRegenError)) {
          setLoadState(previous ? 'success' : 'error');
          return;
        }

                    if (isDailyStylistDisabledError(staleRegenError)) {
                      devDailyHomeLog('[DAILY HOME] daily stylist disabled');
                    } else if (isUnexpectedDailyMutationError(staleRegenError)) {
                      console.error('Unexpected stale daily regeneration error:', staleRegenError);
                    }
                  }
                }

                devDailyHomeLog('[DAILY HOME] suggest skipped');
                return;
              }

              if (!sanitizedItemIds && dailyStylistEnabled && canMutateDaily) {
                devDailyHomeLog('[DAILY HOME] invalid itemIds fallback');

                try {
                  devDailyHomeLog('[DAILY HOME] stale regenerate');
                  dailyProviderAttempted = true;
                  const regenerated = await regenerateDailyOutfit(
                    token,
                    p.localDate,
                    p.requestLocation,
                    { accountScope: p.accountScope },
                  );
                  if (!active()) return;

                  const regeneratedItemIds = sanitizeDailyOutfitItemIds(
                    regenerated.itemIds,
                    p.items,
                  );

                  if (regeneratedItemIds) {
                    applyServerDailyOutfit({
                      ...applyParams,
                      daily: regenerated,
                      sanitizedItemIds: regeneratedItemIds,
                    });
                    devDailyHomeLog('[DAILY HOME] daily replaced');
                    devDailyHomeLog('[DAILY HOME] suggest skipped');
                    return;
                  }
                } catch (invalidRegenError) {
                  if (markRateLimitBlocked(invalidRegenError)) {
                    return;
                  }

                  if (isDailyStylistDisabledError(invalidRegenError)) {
                    devDailyHomeLog('[DAILY HOME] daily stylist disabled');
                  } else if (isUnexpectedDailyMutationError(invalidRegenError)) {
                    console.error('Unexpected invalid daily regeneration error:', invalidRegenError);
                  }
                }

                devDailyHomeLog('[DAILY HOME] invalid itemIds fallback');
              } else if (!sanitizedItemIds) {
                devDailyHomeLog('[DAILY HOME] invalid itemIds fallback');
              }
            } else {
              devDailyHomeLog('[DAILY HOME] server miss');

              if (canMutateDaily) {
                devDailyHomeLog('[DAILY HOME] create missing daily');

                try {
                  dailyProviderAttempted = true;
                  const created = await regenerateDailyOutfit(
                    token,
                    p.localDate,
                    p.requestLocation,
                    {
                      accountScope: p.accountScope,
                      dedupLogLabel: '[DAILY HOME] create dedup',
                    },
                  );
                  if (!active()) return;

                  const createdItemIds = sanitizeDailyOutfitItemIds(created.itemIds, p.items);

                  if (createdItemIds) {
                    applyServerDailyOutfit({
                      daily: created,
                      sanitizedItemIds: createdItemIds,
                      wardrobe: p.items,
                      localDate: p.localDate,
                      legacyWeatherData,
                      persist,
                      runWeatherTask,
                      setHomeOutfit,
                      setWeather,
                      setLoadState,
                      setWeatherLoading,
                      considerWeather: p.stylistPreferences.considerWeather,
                      hasRequestLocation: Boolean(p.requestLocation),
                      currentOutfit,
                      currentEntry,
                      setRecommendationKey,
                    });
                    devDailyHomeLog('[DAILY HOME] missing daily created');
                    devDailyHomeLog('[DAILY HOME] suggest skipped');
                    return;
                  }
                } catch (createMissingError) {
                  if (markRateLimitBlocked(createMissingError)) {
                    return;
                  }

                  if (isRetryableNetworkError(createMissingError)) {
                    devDailyHomeLog('[DAILY HOME] network fallback');
                  } else if (isDailyStylistDisabledError(createMissingError)) {
                    devDailyHomeLog('[DAILY HOME] daily stylist disabled');
                  } else if (isUnexpectedDailyMutationError(createMissingError)) {
                    console.error('Unexpected missing daily creation error:', createMissingError);
                  }
                }
              } else if (dailyStylistEnabled) {
                devDailyHomeLog('[DAILY HOME] waiting for preferences sync');
              }
            }
          }
        } catch (dailyFetchError) {
          if (isRetryableNetworkError(dailyFetchError)) {
            devDailyHomeLog('[DAILY HOME] network fallback');
          } else {
            console.error('Unexpected daily outfit fetch error:', dailyFetchError);
          }
        }
      }

      if (!manual && (cachedUsable || dailyCacheUsable) && cached && weatherCacheReady) {
        const resolvedEntry = dailyCacheUsable
          ? cached
          : { ...cached, inputSignature: cachedSignature };
        currentOutfit.current = cached.outfit;
        currentEntry.current = resolvedEntry;
        setHomeOutfit(cached.outfit);
        setRecommendationKey(resolveCachedRecommendationKey(resolvedEntry, p.localDate));
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
        setRecommendationKey(null);
        setWeather(null);
      }
      setLoadState(previous ? 'success' : 'loading');

      runWeatherTask();

      const cacheFallbackUsable = (cachedUsable || dailyCacheUsable) && cached;
      const fallback = previous ?? (cacheFallbackUsable ? cached!.outfit : null);

      if (fallback) {
        currentOutfit.current = fallback;
        if (!previous && cached) {
          const resolvedEntry = dailyCacheUsable
            ? cached
            : { ...cached, inputSignature: cachedSignature };
          currentEntry.current = resolvedEntry;
          setRecommendationKey(resolveCachedRecommendationKey(resolvedEntry, p.localDate));
        }
        setHomeOutfit(fallback);
        setLoadState('success');
      }

      if (!manual && cacheFallbackUsable && cached) {
        void weatherTask;
        return;
      }

      if (rateLimitBlocked) {
        return;
      }

      const fallbackSkipReason = getDailySuggestFallbackSkipReason({
        isServerAccount: p.isServerAccount,
        dailyStylistEnabled,
        dailyProviderAttempted,
      });

      if (
        !shouldUseDailySuggestFallback({
          isServerAccount: p.isServerAccount,
          dailyStylistEnabled,
          dailyProviderAttempted,
        })
      ) {
        if (fallbackSkipReason === 'provider_failure') {
          devDailyHomeLog('[DAILY AI] fallback skipped reason=provider_failure');
        } else if (fallbackSkipReason === 'daily_stylist_enabled') {
          devDailyHomeLog('[DAILY AI] fallback skipped reason=daily_stylist_enabled');
        }

        if (dailyProviderAttempted) {
          setOutfitErrorKind((current) => current ?? 'server');
          setLoadState(fallback ? 'success' : 'error');
          setError(
            fallback
              ? 'Не удалось обновить образ. Показываем предыдущий вариант.'
              : 'Не удалось подобрать образ на сегодня. Попробуй ещё раз.',
          );
        }

        return;
      }

      try {
        devDailyHomeLog('[DAILY HOME] suggest fallback');
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
        const recommendationKeyForSuggest = createHomeSuggestRecommendationKey();
        const entry = {
          outfit,
          inputSignature: cachedSignature,
          recommendationKey: recommendationKeyForSuggest,
          fetchedAt: Date.now(),
        };
        currentOutfit.current = outfit;
        currentEntry.current = entry;
        setHomeOutfit(outfit);
        setRecommendationKey(recommendationKeyForSuggest);
        setLoadState('success');
        persist(entry);
      } catch (suggestFailure) {
        if (!active()) return;

        const kind: HomeContentErrorKind =
          suggestFailure instanceof OutfitSuggestionError ? suggestFailure.code : 'server';

        if (
          !(suggestFailure instanceof OutfitSuggestionError) &&
          !(suggestFailure instanceof Error && suggestFailure.message === 'No usable outfit')
        ) {
          console.error('Unexpected outfit suggestion error:', suggestFailure);
        }

        setOutfitErrorKind(kind);
        setLoadState(fallback ? 'success' : 'error');

        if (fallback) {
          setError(
            kind === 'network'
              ? `${NETWORK_ERROR_TITLE}. Показываем предыдущий вариант.`
              : kind === 'rate_limited'
                ? AI_RATE_LIMIT_USER_MESSAGE
                : kind === 'provider_rate_limited'
                  ? AI_PROVIDER_RATE_LIMIT_USER_MESSAGE
                  : 'Не удалось обновить образ. Показываем предыдущий вариант.',
          );
        } else {
          setError(
            kind === 'network'
              ? NETWORK_ERROR_TITLE
              : kind === 'rate_limited'
                ? AI_RATE_LIMIT_USER_MESSAGE
                : kind === 'provider_rate_limited'
                  ? suggestFailure instanceof OutfitSuggestionError
                    ? suggestFailure.message
                    : AI_PROVIDER_RATE_LIMIT_USER_MESSAGE
                  : 'Не удалось подобрать образ. Попробуй ещё раз.',
          );
        }
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
  }, [appConfig.dailyStylistEnabled, persist]);

  const loadOutfitFeedback = useCallback(async () => {
    if (!isServerAccount || !recommendationKey) {
      setOutfitFeedback(null);
      setFeedbackLoadError(false);
      setFeedbackLoading(false);
      return;
    }

    setFeedbackLoading(true);
    setFeedbackLoadError(false);

    try {
      const token = await getAuthToken();

      if (!token) {
        setOutfitFeedback(null);
        return;
      }

      const feedback = await fetchOutfitFeedback(token, recommendationKey);
      setOutfitFeedback(feedback);
    } catch (error) {
      if (isRetryableNetworkError(error)) {
        setFeedbackLoadError(true);
      } else {
        console.error('Unexpected outfit feedback load error:', error);
        setOutfitFeedback(null);
      }
    } finally {
      setFeedbackLoading(false);
    }
  }, [isServerAccount, recommendationKey]);

  useEffect(() => {
    void loadOutfitFeedback();
  }, [loadOutfitFeedback]);

  const submitOutfitFeedback = useCallback(
    async (
      rating: 'like' | 'dislike',
      reason?: OutfitFeedbackReason | null,
      targetItemId?: string,
    ) => {
      if (!isServerAccount || !recommendationKey || !currentOutfit.current) {
        return;
      }

      setFeedbackSubmitting(true);
      setFeedbackSubmitError(false);
      pendingFeedbackRating.current = rating;
      pendingFeedbackReason.current = reason;
      pendingFeedbackTargetItemId.current = targetItemId;

      const optimisticFeedback: OutfitFeedback = {
        recommendationKey,
        itemIds: currentOutfit.current.itemIds,
        rating,
        reason: reason ?? null,
        targetItemId: targetItemId ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setOutfitFeedback(optimisticFeedback);

      try {
        const token = await getAuthToken();

        if (!token) {
          throw new Error('Auth token missing');
        }

        const feedback = await saveOutfitFeedback(token, recommendationKey, {
          itemIds: currentOutfit.current.itemIds,
          rating,
          ...(reason ? { reason } : {}),
          ...(targetItemId ? { targetItemId } : {}),
        });
        setOutfitFeedback(feedback);
        pendingFeedbackRating.current = null;
        pendingFeedbackReason.current = undefined;
        pendingFeedbackTargetItemId.current = undefined;
      } catch (error) {
        setOutfitFeedback(null);
        if (isRetryableNetworkError(error)) {
          setFeedbackSubmitError(true);
        } else {
          console.error('Unexpected outfit feedback submit error:', error);
        }
      } finally {
        setFeedbackSubmitting(false);
      }
    },
    [isServerAccount, recommendationKey],
  );

  const retryFeedbackSubmit = useCallback(() => {
    const rating = pendingFeedbackRating.current;

    if (!rating) {
      return;
    }

    void submitOutfitFeedback(
      rating,
      pendingFeedbackReason.current,
      pendingFeedbackTargetItemId.current,
    );
  }, [submitOutfitFeedback]);

  useEffect(() => {
    void sync();
    return () => {
      generation.current += 1;
      busy.current = false;
    };
  }, [isHydrated, isGuestUser, isServerAccount, localDate, preferencesSyncStatus, syncKey, sync]);

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

  const refreshDailyContent = useCallback(() => {
    void sync(false);
  }, [sync]);

  // Retries only the weather request, so the (expensive) outfit suggestion is left untouched.
  const refreshWeather = useCallback(async () => {
    const p = paramsRef.current;

    if (!p.stylistPreferences.considerWeather || !p.requestLocation) {
      return;
    }

    const locationKey = buildLocationKey(p.requestLocation);
    const run = generation.current;

    setWeatherLoading(true);
    setWeatherError(null);

    try {
      const fresh = await fetchCurrentWeather(p.requestLocation);
      if (run !== generation.current) return;

      if (fresh) {
        setWeather(fresh);
        writes.current = writes.current
          .catch(() => {})
          .then(() => saveWeatherCache({ data: fresh, locationKey, fetchedAt: Date.now() }));
      }
    } catch (weatherFailure) {
      if (run !== generation.current) return;

      if (weatherFailure instanceof CurrentWeatherError) {
        setWeatherError(weatherFailure.code);
      } else {
        console.error('Unexpected weather error:', weatherFailure);
        setWeatherError('server');
      }
    } finally {
      if (run === generation.current) setWeatherLoading(false);
    }
  }, []);

  return {
    loadState,
    homeOutfit,
    guestWeatherAdvice,
    guestHomeCta,
    weather,
    weatherError,
    isWeatherLoading,
    isRegenerating,
    regenerateError,
    outfitErrorKind,
    regenerateOutfit,
    refreshDailyContent,
    refreshWeather,
    replaceItem,
    recommendationKey,
    outfitFeedback,
    isFeedbackLoading,
    feedbackLoadError,
    isFeedbackSubmitting,
    feedbackSubmitError,
    submitOutfitFeedback,
    retryOutfitFeedbackLoad: loadOutfitFeedback,
    retryFeedbackSubmit,
    feedbackEnabled: isServerAccount && recommendationKey !== null,
  };
}
