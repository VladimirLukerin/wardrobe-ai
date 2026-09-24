import type { Request, Response } from 'express';
import OpenAI from 'openai';

import { enforceAiRateLimit } from '../ai-request-rate-limit';
import { trackOpenAiResponsesCall } from '../ai-usage/record-ai-usage';
import { respondIfGuestAiDisabled } from '../app-settings/guest-ai-access';
import { respondIfPairedOutfitsDisabled } from '../app-settings/paired-outfits-access';
import {
  buildPairedOutfitPromptText,
  capBehavioralContext,
  logPairedPromptUsage,
  selectOutfitCandidates,
} from '../outfit-ai/prompt-optimization';
import {
  AiProviderRateLimitError,
  isOpenAiProviderRateLimitError,
  respondAiProviderRateLimited,
  toAiProviderRateLimitError,
} from '../outfit-ai/provider-rate-limit';
import { resolveFamilyMemberWardrobeAccess } from '../db/family-repository';
import type { CurrentWeather } from '../providers/weather';
import {
  hasMinimumWardrobeForOutfit,
  resolveWeatherContext,
  sanitizeItemIdsByCategory,
  type SuggestOutfitsLocation,
  type WardrobeItemPayload,
} from '../suggest-outfits';
import { buildPersonPairedOutfitContext, type PersonPairedOutfitContext } from './build-person-context';

const MODEL = 'gpt-4o';
const MATCHING_MODES = ['natural', 'same_style', 'colors', 'photo'] as const;
const FIXED_ITEM_OWNERS = ['self', 'member'] as const;

type MatchingMode = (typeof MATCHING_MODES)[number];
type FixedItemOwner = (typeof FIXED_ITEM_OWNERS)[number];

export type PairedOutfitPersonResult = {
  itemIds: string[];
};

export type PairedOutfitResponse = {
  personA: PairedOutfitPersonResult;
  personB: PairedOutfitPersonResult;
  pairExplanation: string;
  weather: CurrentWeather | null;
};

type RawPairedOutfitResponse = {
  personA?: { itemIds?: string[] };
  personB?: { itemIds?: string[] };
  pairExplanation?: string;
};

type ParsedPairedOutfitsRequest = {
  occasion: string;
  matchingMode: MatchingMode;
  location: SuggestOutfitsLocation | null;
  fixedItemId?: string;
  fixedItemOwner?: FixedItemOwner;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getRouteParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim().length > 0) {
    return value[0].trim();
  }

  return null;
}

function parseMatchingMode(value: unknown): MatchingMode | null {
  if (typeof value === 'string' && MATCHING_MODES.includes(value as MatchingMode)) {
    return value as MatchingMode;
  }

  return null;
}

function parseLocation(value: unknown): SuggestOutfitsLocation | null {
  if (!isRecord(value)) {
    return null;
  }

  const latitude = value.latitude;
  const longitude = value.longitude;

  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
    name: typeof value.name === 'string' && value.name.trim().length > 0 ? value.name.trim() : undefined,
  };
}

function parseFixedItemOwner(value: unknown): FixedItemOwner | null {
  if (typeof value === 'string' && FIXED_ITEM_OWNERS.includes(value as FixedItemOwner)) {
    return value as FixedItemOwner;
  }

  return null;
}

function parsePairedOutfitsRequest(body: unknown): ParsedPairedOutfitsRequest | null {
  if (!isRecord(body)) {
    return null;
  }

  const occasion = typeof body.occasion === 'string' ? body.occasion.trim() : '';

  if (!occasion) {
    return null;
  }

  const matchingMode = parseMatchingMode(body.matchingMode);

  if (!matchingMode) {
    return null;
  }

  const fixedItemId =
    typeof body.fixedItemId === 'string' && body.fixedItemId.trim().length > 0
      ? body.fixedItemId.trim()
      : undefined;
  const fixedItemOwner = fixedItemId
    ? (parseFixedItemOwner(body.fixedItemOwner) ?? undefined)
    : undefined;

  if (fixedItemId && !fixedItemOwner) {
    return null;
  }

  if (!fixedItemId && body.fixedItemOwner !== undefined) {
    return null;
  }

  return {
    occasion,
    matchingMode,
    location: parseLocation(body.location),
    fixedItemId,
    fixedItemOwner,
  };
}


function validateFixedItemAccess(
  parsedBody: ParsedPairedOutfitsRequest,
  personA: PersonPairedOutfitContext,
  personB: PersonPairedOutfitContext,
): { status: number; message: string } | null {
  if (!parsedBody.fixedItemId || !parsedBody.fixedItemOwner) {
    return null;
  }

  const targetWardrobe =
    parsedBody.fixedItemOwner === 'self' ? personA.wardrobe : personB.wardrobe;
  const ownerLabel = parsedBody.fixedItemOwner === 'self' ? 'вашем гардеробе' : 'гардеробе члена семьи';

  if (!targetWardrobe.some((item) => item.id === parsedBody.fixedItemId)) {
    return {
      status: 404,
      message: `Выбранная вещь недоступна в ${ownerLabel}.`,
    };
  }

  return null;
}

function buildPersonShortlist(
  person: PersonPairedOutfitContext,
  weather: CurrentWeather | null,
  occasion: string,
  matchingMode: MatchingMode,
  mode: 'paired-owner' | 'paired-member',
  fixedItemId?: string,
): WardrobeItemPayload[] {
  const cappedBehavior = capBehavioralContext(person.behavioralContext);

  return selectOutfitCandidates({
    wardrobe: person.wardrobe,
    weather,
    stylistPreferences: person.stylistPreferences,
    userParameters: person.userParameters,
    behavioralContext: cappedBehavior,
    fixedItemId,
    occasion,
    mode,
    matchingMode,
  });
}

function assertFixedItemPresent(itemIds: string[], fixedItemId: string | undefined): boolean {
  if (!fixedItemId) {
    return true;
  }

  return itemIds.includes(fixedItemId);
}

function sanitizePersonOutfitItemIds(
  rawItemIds: string[],
  wardrobe: WardrobeItemPayload[],
  fixedItemId?: string,
): string[] {
  const validIds = new Set(wardrobe.map((item) => item.id));
  const filteredIds = rawItemIds.filter((itemId) => validIds.has(itemId));
  const uniqueIds = [...new Set(filteredIds)];

  if (fixedItemId && validIds.has(fixedItemId) && !uniqueIds.includes(fixedItemId)) {
    uniqueIds.unshift(fixedItemId);
  }

  const wardrobeById = new Map(wardrobe.map((item) => [item.id, item]));

  return sanitizeItemIdsByCategory(uniqueIds, wardrobeById, fixedItemId);
}

function hasValidPairedOutfit(itemIds: string[]): boolean {
  return itemIds.length >= 2;
}

export async function suggestPairedOutfitsHandler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.authUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (respondIfPairedOutfitsDisabled(res)) {
      return;
    }

    if (respondIfGuestAiDisabled(res, req.authUser)) {
      return;
    }

    const memberPublicId = getRouteParam(req.params.memberPublicId);

    if (!memberPublicId) {
      res.status(400).json({ error: 'Некорректный ID пользователя.' });
      return;
    }

    const parsedBody = parsePairedOutfitsRequest(req.body);

    if (!parsedBody) {
      res.status(400).json({ error: 'Некорректное тело запроса.' });
      return;
    }

    const access = resolveFamilyMemberWardrobeAccess(req.authUser.id, memberPublicId);

    if ('status' in access) {
      res.status(access.status).json({ error: access.message });
      return;
    }

    const personA = buildPersonPairedOutfitContext(req.authUser.id);
    const personB = buildPersonPairedOutfitContext(access.targetUserId);

    const fixedItemError = validateFixedItemAccess(parsedBody, personA, personB);

    if (fixedItemError) {
      res.status(fixedItemError.status).json({ error: fixedItemError.message });
      return;
    }

    if (
      !hasMinimumWardrobeForOutfit(personA.wardrobe) ||
      !hasMinimumWardrobeForOutfit(personB.wardrobe)
    ) {
      res.status(422).json({ error: 'Недостаточно вещей для совместного образа' });
      return;
    }

    const considerWeather = personA.stylistPreferences.considerWeather;
    const weather = await resolveWeatherContext(considerWeather, parsedBody.location);
    const ownerFixedItemId =
      parsedBody.fixedItemOwner === 'self' ? parsedBody.fixedItemId : undefined;
    const memberFixedItemId =
      parsedBody.fixedItemOwner === 'member' ? parsedBody.fixedItemId : undefined;
    const ownerShortlist = buildPersonShortlist(
      personA,
      weather,
      parsedBody.occasion,
      parsedBody.matchingMode,
      'paired-owner',
      ownerFixedItemId,
    );
    const memberShortlist = buildPersonShortlist(
      personB,
      weather,
      parsedBody.occasion,
      parsedBody.matchingMode,
      'paired-member',
      memberFixedItemId,
    );

    if (ownerFixedItemId && !ownerShortlist.some((item) => item.id === ownerFixedItemId)) {
      res.status(422).json({ error: 'Не удалось включить выбранную вещь в подбор для вашего образа.' });
      return;
    }

    if (memberFixedItemId && !memberShortlist.some((item) => item.id === memberFixedItemId)) {
      res.status(422).json({
        error: 'Не удалось включить выбранную вещь в подбор для образа члена семьи.',
      });
      return;
    }

    if (!enforceAiRateLimit(res, req.authUser.id, 'paired')) {
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      res.status(500).json({ error: 'OPENAI_API_KEY не настроен на сервере.' });
      return;
    }

    const openai = new OpenAI({ apiKey, maxRetries: 0 });

    const promptText = buildPairedOutfitPromptText({
      occasion: parsedBody.occasion,
      matchingMode: parsedBody.matchingMode,
      weather,
      considerWeather,
      personA: {
        label: 'A',
        stylistPreferences: personA.stylistPreferences,
        userParameters: personA.userParameters,
        behavioralContext: capBehavioralContext(personA.behavioralContext),
        wardrobe: ownerShortlist,
        fixedItemId: ownerFixedItemId,
      },
      personB: {
        label: 'B',
        stylistPreferences: personB.stylistPreferences,
        userParameters: personB.userParameters,
        behavioralContext: capBehavioralContext(personB.behavioralContext),
        wardrobe: memberShortlist,
        fixedItemId: memberFixedItemId,
      },
    });

    logPairedPromptUsage({
      ownerTotal: personA.wardrobe.length,
      ownerShortlist: ownerShortlist.length,
      memberTotal: personB.wardrobe.length,
      memberShortlist: memberShortlist.length,
      promptText,
    });

    let response;

    try {
      response = await trackOpenAiResponsesCall({
        userId: req.authUser.id,
        requestType: 'paired',
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
          name: 'paired_outfit_suggestion',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              personA: {
                type: 'object',
                properties: {
                  itemIds: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
                required: ['itemIds'],
                additionalProperties: false,
              },
              personB: {
                type: 'object',
                properties: {
                  itemIds: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
                required: ['itemIds'],
                additionalProperties: false,
              },
              pairExplanation: { type: 'string' },
            },
            required: ['personA', 'personB', 'pairExplanation'],
            additionalProperties: false,
          },
        },
      },
    }),
      });
    } catch (providerError) {
      if (isOpenAiProviderRateLimitError(providerError)) {
        throw toAiProviderRateLimitError(providerError);
      }

      throw providerError;
    }

    if (process.env.NODE_ENV !== 'production' && response.usage) {
      logPairedPromptUsage({
        ownerTotal: personA.wardrobe.length,
        ownerShortlist: ownerShortlist.length,
        memberTotal: personB.wardrobe.length,
        memberShortlist: memberShortlist.length,
        promptText,
        actualInputTokens: response.usage.input_tokens,
        actualOutputTokens: response.usage.output_tokens,
        actualTotalTokens: response.usage.total_tokens,
      });
    }

    const outputText = response.output_text;

    if (!outputText) {
      res.status(502).json({ error: 'OpenAI не вернул результат подбора образов.' });
      return;
    }

    const parsed = JSON.parse(outputText) as RawPairedOutfitResponse;
    const rawPersonAIds = Array.isArray(parsed.personA?.itemIds) ? parsed.personA.itemIds : [];
    const rawPersonBIds = Array.isArray(parsed.personB?.itemIds) ? parsed.personB.itemIds : [];
    const personAItemIds = sanitizePersonOutfitItemIds(rawPersonAIds, personA.wardrobe, ownerFixedItemId);
    const personBItemIds = sanitizePersonOutfitItemIds(rawPersonBIds, personB.wardrobe, memberFixedItemId);

    if (
      !assertFixedItemPresent(personAItemIds, ownerFixedItemId) ||
      !assertFixedItemPresent(personBItemIds, memberFixedItemId)
    ) {
      res.status(422).json({ error: 'Не удалось сохранить выбранную вещь в совместном образе.' });
      return;
    }

    if (!hasValidPairedOutfit(personAItemIds) || !hasValidPairedOutfit(personBItemIds)) {
      res.status(422).json({ error: 'Недостаточно вещей для совместного образа' });
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[PAIR OUTFIT] result A=${personAItemIds.length} B=${personBItemIds.length}`,
      );
    }

    const pairExplanation =
      typeof parsed.pairExplanation === 'string' ? parsed.pairExplanation.trim() : '';

    const result: PairedOutfitResponse = {
      personA: { itemIds: personAItemIds },
      personB: { itemIds: personBItemIds },
      pairExplanation,
      weather,
    };

    res.json(result);
  } catch (error) {
    if (error instanceof AiProviderRateLimitError) {
      respondAiProviderRateLimited(res, error.retryAfterSeconds);
      return;
    }

    console.error('Failed to suggest paired outfits:', error);
    res.status(500).json({ error: 'Не удалось подобрать совместный образ.' });
  }
}
