import type { Request, Response } from 'express';
import OpenAI from 'openai';

import { enforceAiRateLimit } from '../ai-request-rate-limit';
import {
  buildCompactWardrobeSummary,
  capBehavioralContext,
  estimatePromptTokens,
  selectOutfitCandidates,
  summarizeCandidateSelection,
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
  buildFitPreferenceLines,
  buildSharedSelectionRules,
  buildWeatherSection,
  buildWeatherSensitivityInstructions,
  hasMinimumWardrobeForOutfit,
  resolveWeatherContext,
  sanitizeItemIdsByCategory,
  type StylistPreferencesPayload,
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


function buildPairedPriorityOrderSection(): string[] {
  return [
    'SIGNAL PRIORITY (highest to lowest):',
    '1. occasion / event appropriateness;',
    '2. weather / physical comfort (shared weather, per-person sensitivity);',
    '3. category compatibility within each outfit;',
    '4. explicit user parameters (fitPreference, weatherSensitivity);',
    '5. behavioral signals (usageTier, favorites, saved outfits) — ONLY after suitability;',
    '6. pair compatibility between the two finished outfits.',
    '',
    'Behavioral signals must NOT override occasion, weather, or category logic.',
    'Never recommend unsuitable items just because they are rarely worn.',
  ];
}

type StyleExperiment = StylistPreferencesPayload['styleExperiment'];

function buildPairedStyleExperimentInstructions(styleExperiment: StyleExperiment): string[] {
  switch (styleExperiment) {
    case 'familiar':
      return [
        'BEHAVIOR MODE: familiar (привычное).',
        'Apply ONLY after the item passes occasion, weather, and category checks.',
        'Prefer usageTier frequent/regular, favorites, and items from saved outfits.',
        'Prefer familiar combinations, but do not return the exact same outfit every time.',
      ];
    case 'bold':
      return [
        'BEHAVIOR MODE: bold (смелее).',
        'Apply ONLY after the item passes occasion, weather, and category checks.',
        'Increase priority for usageTier rare/never and long-unworn items when suitable.',
        'Keep at least one familiar anchor item when it improves outfit coherence.',
        'Rarely worn does NOT automatically mean bold — suitability comes first.',
      ];
    case 'balanced':
    default:
      return [
        'BEHAVIOR MODE: balanced (баланс).',
        'Apply ONLY after the item passes occasion, weather, and category checks.',
        'Mix a familiar base with 1 or more less-used suitable items.',
        'Example: favorite pants + jacket not worn for a long time.',
      ];
  }
}

function buildMatchingModeInstructions(matchingMode: MatchingMode): string[] {
  switch (matchingMode) {
    case 'same_style':
      return [
        'PAIR MATCHING MODE: same_style.',
        'Stronger alignment in overall style (for example both smart casual).',
        'Outfits may differ in specific items but should read as the same style family.',
      ];
    case 'colors':
      return [
        'PAIR MATCHING MODE: colors.',
        'Primary focus on color harmony between the two outfits.',
        'Colors do not need to be identical — complementary, neutral, and accent matching are allowed.',
      ];
    case 'photo':
      return [
        'PAIR MATCHING MODE: photo.',
        'Optimize how the two outfits look standing next to each other in photos.',
        'Avoid conflicting large prints and two competing strong accents.',
        'Create visual separation between the two people while keeping harmony.',
      ];
    case 'natural':
    default:
      return [
        'PAIR MATCHING MODE: natural.',
        'Compatible formality level with soft color/style connection.',
        'Outfits should coordinate but must NOT look identical or copy the same silhouette.',
      ];
  }
}

function formatCompactOutfits(
  outfits: Array<{ itemIds: string[]; title?: string }>,
): string {
  if (outfits.length === 0) {
    return '- none';
  }

  return outfits
    .map((outfit) => {
      const titlePart = outfit.title ? ` title="${outfit.title}"` : '';

      return `- itemIds: [${outfit.itemIds.join(', ')}]${titlePart}`;
    })
    .join('\n');
}

function buildPersonSection(
  label: string,
  person: PersonPairedOutfitContext,
  shortlist: WardrobeItemPayload[],
  fixedItemId?: string,
): string[] {
  const { stylistPreferences, userParameters, behavioralContext } = person;

  const lines = [
    label,
    `displayName: ${person.displayName ?? 'unknown'}`,
    `styleExperiment: ${stylistPreferences.styleExperiment}`,
    `wardrobeMode: ${stylistPreferences.wardrobeMode}`,
    '',
    ...buildPairedStyleExperimentInstructions(stylistPreferences.styleExperiment),
  ];

  const fitLines = buildFitPreferenceLines(userParameters.fitPreference);

  if (fitLines.length > 0) {
    lines.push('', ...fitLines);
  }

  if (userParameters.weatherSensitivity) {
    lines.push('', ...buildWeatherSensitivityInstructions(userParameters.weatherSensitivity));
  }

  if (fixedItemId) {
    const fixedItem = shortlist.find((item) => item.id === fixedItemId);

    lines.push(
      '',
      'FIXED ITEM (mandatory):',
      `- fixedItemId "${fixedItemId}" MUST appear in this person's itemIds.`,
      `- Never replace or omit it; build the safest reasonable outfit around it.`,
      fixedItem ? `- fixed item: ${fixedItem.name} (${fixedItem.category}, ${fixedItem.color})` : '',
    );
  }

  lines.push(
    '',
    'behavior summary:',
    `favoriteItemIds: [${behavioralContext.favoriteItemIds.join(', ') || 'none'}]`,
    '',
    'recentManualOutfits (strong preference):',
    formatCompactOutfits(behavioralContext.recentManualOutfits),
    '',
    'recentSavedAiOutfits (secondary preference):',
    formatCompactOutfits(behavioralContext.recentSavedAiOutfits),
    '',
    'shortlisted wardrobe:',
    buildCompactWardrobeSummary(shortlist),
  );

  return lines;
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

    const promptLines = [
      'You are a stylist creating TWO coordinated outfits for two people going to the same event.',
      'Use ONLY items from each person wardrobe. Never invent items.',
      'Return exactly ONE outfit per person in a single response.',
      '',
      ...buildPairedPriorityOrderSection(),
      '',
      'A. HARD RULES',
      '- personA.itemIds must come ONLY from PERSON A wardrobe.',
      '- personB.itemIds must come ONLY from PERSON B wardrobe.',
      '- Each outfit: max 1 bottom, max 1 shoes, max 1 outerwear, max 2 tops.',
      '- Do not include category conflicts within either outfit.',
      '- wardrobeMode owned-only for both: never add shopping suggestions as itemIds.',
      '- pairExplanation must be in Russian.',
      '',
      'B. OCCASION',
      `- event / occasion: ${parsedBody.occasion}`,
      '',
      ...buildMatchingModeInstructions(parsedBody.matchingMode),
    ];

    if (weather) {
      promptLines.push('', ...buildWeatherSection(weather));
      promptLines.push(
        '',
        'Shared weather applies to both people because they go together.',
        'Apply each person weatherSensitivity separately on top of this shared weather.',
      );
    } else if (considerWeather) {
      promptLines.push(
        '',
        'C. CURRENT WEATHER',
        '- Weather requested but unavailable — choose reasonable layers from each wardrobe.',
      );
    } else {
      promptLines.push('', 'C. CURRENT WEATHER', '- Weather consideration disabled by initiator.');
    }

    promptLines.push(
      '',
      'D. PERSON A (initiator — current user)',
      ...buildPersonSection('PERSON A profile:', personA, ownerShortlist, ownerFixedItemId),
      '',
      'E. PERSON B (family member)',
      ...buildPersonSection('PERSON B profile:', personB, memberShortlist, memberFixedItemId),
      '',
      'F. TASK',
      'Pick ONE complete outfit for PERSON A and ONE complete outfit for PERSON B.',
      'Outfits must suit the occasion and weather, respect each person behavior mode separately, and match according to the pair matching mode.',
      'Outfits do NOT need to look identical.',
      '',
      ...buildSharedSelectionRules().slice(0, 6),
      '',
      'pairExplanation: 2-3 Russian sentences explaining why both outfits work together for the occasion.',
    );

    const promptText = promptLines.join('\n');

    if (process.env.NODE_ENV !== 'production') {
      const ownerSummary = summarizeCandidateSelection(personA.wardrobe.length, ownerShortlist);
      const memberSummary = summarizeCandidateSelection(personB.wardrobe.length, memberShortlist);

      console.log(
        `[PAIRED AI] owner total=${ownerSummary.total} selected=${ownerSummary.selected} ` +
          `member total=${memberSummary.total} selected=${memberSummary.selected} ` +
          `promptChars=${promptText.length} estimatedTokens=${estimatePromptTokens(promptText)}`,
      );
    }

    let response;

    try {
      response = await openai.responses.create({
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
    });
    } catch (providerError) {
      if (isOpenAiProviderRateLimitError(providerError)) {
        throw toAiProviderRateLimitError(providerError);
      }

      throw providerError;
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
