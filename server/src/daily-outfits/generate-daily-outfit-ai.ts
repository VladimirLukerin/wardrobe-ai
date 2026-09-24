import OpenAI from 'openai';

import { consumeAiRateLimit, AiRateLimitExceededError } from '../ai-request-rate-limit';
import { trackOpenAiResponsesCall } from '../ai-usage/record-ai-usage';
import {
  buildDailyOutfitPromptText,
  capBehavioralContext,
  estimatePromptTokens,
  logDailyPromptUsage,
} from '../outfit-ai/prompt-optimization';
import { selectOutfitCandidates } from '../outfit-ai/candidate-selection';
import {
  isOpenAiProviderRateLimitError,
  toAiProviderRateLimitError,
} from '../outfit-ai/provider-rate-limit';
import { mergeOutfitFeedbackIntoBehavioralContext } from '../outfit-feedback/build-outfit-feedback-context';
import type { CurrentWeather } from '../providers/weather';
import {
  resolveWeatherContext,
  sanitizeItemIdsByCategory,
  type BehavioralContextPayload,
  type StylistPreferencesPayload,
  type SuggestOutfitsLocation,
  type UserParametersPayload,
  type WardrobeItemPayload,
} from '../suggest-outfits';
import type { DailyGenerationReason } from './resolve-daily-generation';

const MODEL = 'gpt-4o';

type RawDailyOutfitResponse = {
  itemIds?: string[];
  description?: string;
};

export async function generateDailyOutfitWithAi({
  userId,
  wardrobe,
  stylistPreferences,
  userParameters,
  behavioralContext: parsedBehavioralContext,
  location,
  reason,
}: {
  userId: string;
  wardrobe: WardrobeItemPayload[];
  stylistPreferences: StylistPreferencesPayload;
  userParameters: UserParametersPayload;
  behavioralContext: BehavioralContextPayload;
  location: SuggestOutfitsLocation | null;
  reason: DailyGenerationReason;
}): Promise<{ itemIds: string[]; description: string; weather: CurrentWeather | null }> {
  const validIds = new Set(wardrobe.map((item) => item.id));
  const behavioralContext = capBehavioralContext(
    mergeOutfitFeedbackIntoBehavioralContext(parsedBehavioralContext, userId, validIds),
  );
  const weather = await resolveWeatherContext(stylistPreferences.considerWeather, location);
  const shortlist = selectOutfitCandidates({
    wardrobe,
    weather,
    stylistPreferences,
    userParameters,
    behavioralContext,
    mode: 'personal',
  });
  const shortlistIds = new Set(shortlist.map((item) => item.id));
  const promptText = buildDailyOutfitPromptText({
    wardrobe: shortlist,
    weather,
    considerWeather: stylistPreferences.considerWeather,
    stylistPreferences,
    userParameters,
    behavioralContext,
  });

  logDailyPromptUsage({
    reason,
    wardrobeTotal: wardrobe.length,
    shortlist: shortlist.length,
    promptText,
  });

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY не настроен на сервере.');
  }

  try {
    consumeAiRateLimit(userId, 'daily');
  } catch (error) {
    if (error instanceof AiRateLimitExceededError) {
      throw error;
    }

    throw error;
  }

  const openai = new OpenAI({ apiKey, maxRetries: 0 });

  let response;

  try {
    response = await trackOpenAiResponsesCall({
      userId,
      requestType: 'daily',
      call: () =>
        openai.responses.create({
      model: MODEL,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: promptText,
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'daily_outfit',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              itemIds: {
                type: 'array',
                items: { type: 'string' },
              },
              description: { type: 'string' },
            },
            required: ['itemIds', 'description'],
            additionalProperties: false,
          },
        },
      },
    }),
    });
  } catch (error) {
    if (isOpenAiProviderRateLimitError(error)) {
      throw toAiProviderRateLimitError(error);
    }

    throw error;
  }

  if (process.env.NODE_ENV !== 'production' && response.usage) {
    logDailyPromptUsage({
      reason,
      wardrobeTotal: wardrobe.length,
      shortlist: shortlist.length,
      promptText,
      actualInputTokens: response.usage.input_tokens,
      actualOutputTokens: response.usage.output_tokens,
      actualTotalTokens: response.usage.total_tokens,
    });
  }

  const outputText = response.output_text;

  if (!outputText) {
    throw new Error('OpenAI не вернул результат daily outfit.');
  }

  const parsed = JSON.parse(outputText) as RawDailyOutfitResponse;
  const rawItemIds = Array.isArray(parsed.itemIds) ? parsed.itemIds : [];
  const filteredIds = rawItemIds.filter(
    (itemId): itemId is string => typeof itemId === 'string' && shortlistIds.has(itemId),
  );
  const uniqueIds = [...new Set(filteredIds)];
  const wardrobeById = new Map(shortlist.map((item) => [item.id, item]));
  const itemIds = sanitizeItemIdsByCategory(uniqueIds, wardrobeById);
  const description = typeof parsed.description === 'string' ? parsed.description.trim() : '';

  return { itemIds, description, weather };
}
