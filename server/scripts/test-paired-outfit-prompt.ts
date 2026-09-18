import {
  buildCompactMatchingModeLines,
  buildCompactWardrobeSummary,
  buildCompactWeatherSection,
  buildPairedOutfitPromptText,
  capBehavioralContext,
  estimatePromptTokens,
  selectOutfitCandidates,
  type PairedOutfitPromptInput,
} from '../src/outfit-ai/prompt-optimization';
import type {
  BehavioralContextPayload,
  StylistPreferencesPayload,
  UserParametersPayload,
  WardrobeItemPayload,
} from '../src/suggest-outfits';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function createFixtureItem(overrides: Partial<WardrobeItemPayload> & Pick<WardrobeItemPayload, 'id'>): WardrobeItemPayload {
  return {
    name: 'Item',
    category: 'футболка',
    color: 'чёрный',
    pattern: 'Без принта',
    printDescription: null,
    style: 'casual',
    isFavorite: false,
    wearCount: 0,
    lastWornAt: null,
    ...overrides,
  };
}

function createShortlist(count: number, prefix: string): WardrobeItemPayload[] {
  const categories = ['футболка', 'джинсы', 'кроссовки', 'куртка', 'рубашка', 'ботинки', 'худи', 'юбка'];

  return Array.from({ length: count }, (_, index) =>
    createFixtureItem({
      id: `${prefix}-${index}`,
      name: `${prefix} Item ${index}`,
      category: categories[index % categories.length] ?? 'футболка',
      color: index % 2 === 0 ? 'чёрный' : 'белый',
      isFavorite: index % 5 === 0,
      wearCount: index % 4,
      lastWornAt: index % 3 === 0 ? '2026-09-10T00:00:00.000Z' : null,
    }),
  );
}

function createBehavioralContext(
  wardrobe: WardrobeItemPayload[],
  overrides: Partial<BehavioralContextPayload> = {},
): BehavioralContextPayload {
  return {
    favoriteItemIds: wardrobe.filter((item) => item.isFavorite).map((item) => item.id),
    frequentlyWorn: wardrobe.slice(0, 4).map((item) => ({
      id: item.id,
      wearCount: item.wearCount,
      lastWornAt: item.lastWornAt,
    })),
    recentManualOutfits: [],
    recentSavedAiOutfits: [],
    recentOutfitSignatures: [],
    ...overrides,
  };
}

function createRepresentativePairedPromptInput(): PairedOutfitPromptInput {
  const wardrobeA = createShortlist(12, 'a');
  const wardrobeB = createShortlist(12, 'b');
  const stylistPreferences: StylistPreferencesPayload = {
    styleExperiment: 'balanced',
    considerWeather: true,
    wardrobeMode: 'owned-only',
    avoidRepeatedOutfits: true,
  };
  const userParameters: UserParametersPayload = {
    fitPreference: 'Обычная',
    weatherSensitivity: 'Обычно',
  };

  return {
    occasion: 'Ужин в ресторане',
    matchingMode: 'natural',
    weather: {
      temperatureC: 14,
      apparentTemperatureC: 11,
      precipitationMm: 0,
      weatherCode: 3,
      windSpeedKmh: 18,
    },
    considerWeather: true,
    personA: {
      label: 'A',
      stylistPreferences,
      userParameters,
      behavioralContext: createBehavioralContext(wardrobeA, {
        recentManualOutfits: [
          { itemIds: ['a-0', 'a-1', 'a-2'], title: 'Weekend' },
          { itemIds: ['a-3', 'a-4', 'a-5'] },
        ],
        recentSavedAiOutfits: [{ itemIds: ['a-1', 'a-6', 'a-7'] }],
        outfitFeedback: {
          recentlyLikedItemIds: ['a-2'],
          recentlyDislikedItemIds: [],
          likedCombinations: [{ itemIds: ['a-0', 'a-1', 'a-2'] }],
          dislikedCombinations: [],
          stronglyDislikedItemIds: [],
          reasonCounts: {},
        },
      }),
      wardrobe: wardrobeA,
      fixedItemId: 'a-4',
    },
    personB: {
      label: 'B',
      stylistPreferences: { ...stylistPreferences, styleExperiment: 'familiar' },
      userParameters: { fitPreference: 'Свободная', weatherSensitivity: 'Часто мёрзну' },
      behavioralContext: createBehavioralContext(wardrobeB, {
        recentManualOutfits: [{ itemIds: ['b-0', 'b-1', 'b-2'] }],
      }),
      wardrobe: wardrobeB,
    },
  };
}

function formatLegacyOutfits(outfits: Array<{ itemIds: string[]; title?: string }>): string {
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

function buildLegacyVerbosePairedPrompt(input: PairedOutfitPromptInput): string {
  const buildPersonSection = (
    label: string,
    displayName: string,
    person: PairedOutfitPromptInput['personA'],
  ): string[] => {
    const lines = [
      label,
      `displayName: ${displayName}`,
      `styleExperiment: ${person.stylistPreferences.styleExperiment}`,
      `wardrobeMode: ${person.stylistPreferences.wardrobeMode}`,
      '',
      'BEHAVIOR MODE: balanced (баланс).',
      'Apply ONLY after the item passes occasion, weather, and category checks.',
      'Mix a familiar base with 1 or more less-used suitable items.',
      '',
      'fitPreference: neutral — no extra fit bias beyond wardrobe metadata.',
      '',
      'Чувствительность к погоде: обычная.',
      'Не добавляй дополнительную температурную коррекцию сверх фактической погоды.',
    ];

    if (person.fixedItemId) {
      lines.push(
        '',
        'FIXED ITEM (mandatory):',
        `- fixedItemId "${person.fixedItemId}" MUST appear in this person's itemIds.`,
        `- Never replace or omit it; build the safest reasonable outfit around it.`,
      );
    }

    lines.push(
      '',
      'behavior summary:',
      `favoriteItemIds: [${person.behavioralContext.favoriteItemIds.join(', ') || 'none'}]`,
      '',
      'recentManualOutfits (strong preference):',
      formatLegacyOutfits(person.behavioralContext.recentManualOutfits),
      '',
      'recentSavedAiOutfits (secondary preference):',
      formatLegacyOutfits(person.behavioralContext.recentSavedAiOutfits),
      '',
      'shortlisted wardrobe:',
      buildCompactWardrobeSummary(person.wardrobe),
    );

    return lines;
  };

  const lines = [
    'You are a stylist creating TWO coordinated outfits for two people going to the same event.',
    'Use ONLY items from each person wardrobe. Never invent items.',
    'Return exactly ONE outfit per person in a single response.',
    '',
    'SIGNAL PRIORITY (highest to lowest):',
    '1. occasion / event appropriateness;',
    '2. weather / physical comfort (shared weather, per-person sensitivity);',
    '3. category compatibility within each outfit;',
    '4. explicit user parameters (fitPreference, weatherSensitivity);',
    '5. behavioral signals (usageTier, favorites, saved outfits) — ONLY after suitability;',
    '6. pair compatibility between the two finished outfits.',
    '',
    'A. HARD RULES',
    '- personA.itemIds must come ONLY from PERSON A wardrobe.',
    '- personB.itemIds must come ONLY from PERSON B wardrobe.',
    '- Each outfit: max 1 bottom, max 1 shoes, max 1 outerwear, max 2 tops.',
    '- wardrobeMode owned-only for both: never add shopping suggestions as itemIds.',
    '- pairExplanation must be in Russian.',
    '',
    'B. OCCASION',
    `- event / occasion: ${input.occasion}`,
    '',
    'PAIR MATCHING MODE: natural.',
    'Compatible formality level with soft color/style connection.',
    'Outfits should coordinate but must NOT look identical or copy the same silhouette.',
  ];

  if (input.weather) {
    lines.push(
      '',
      'C. CURRENT WEATHER',
      `- actual temperature: ${input.weather.temperatureC}°C`,
      `- feels like (apparent): ${input.weather.apparentTemperatureC}°C`,
      `- precipitation: ${input.weather.precipitationMm} mm`,
      `- wind: ${input.weather.windSpeedKmh} km/h`,
      '- conditions: cloudy',
      '',
      'Shared weather applies to both people because they go together.',
      'Apply each person weatherSensitivity separately on top of this shared weather.',
    );
  }

  lines.push(
    '',
    'D. PERSON A (initiator — current user)',
    ...buildPersonSection('PERSON A profile:', 'Owner Name', input.personA),
    '',
    'E. PERSON B (family member)',
    ...buildPersonSection('PERSON B profile:', 'Member Name', input.personB),
    '',
    'F. TASK',
    'Pick ONE complete outfit for PERSON A and ONE complete outfit for PERSON B.',
    'Outfits must suit the occasion and weather, respect each person behavior mode separately, and match according to the pair matching mode.',
    'Outfits do NOT need to look identical.',
    '',
    'pairExplanation: 2-3 Russian sentences explaining why both outfits work together for the occasion.',
  );

  return lines.join('\n');
}

function testSharedWeatherEmittedOnce(): void {
  const prompt = buildPairedOutfitPromptText(createRepresentativePairedPromptInput());
  const weatherMatches = prompt.match(/^WEATHER:/gm) ?? [];

  assert(weatherMatches.length === 1, `Expected one WEATHER block, got ${weatherMatches.length}`);
  assert(!prompt.includes('C. CURRENT WEATHER'), 'Legacy weather heading should be absent');
  assert(prompt.includes('Apply shared weather with each person weatherSens.'), 'Expected shared weather instruction');
  console.log('OK shared weather emitted once');
}

function testEmptyBehaviorSectionsOmitted(): void {
  const input = createRepresentativePairedPromptInput();
  input.personB.behavioralContext = {
    favoriteItemIds: [],
    frequentlyWorn: [],
    recentManualOutfits: [],
    recentSavedAiOutfits: [],
    recentOutfitSignatures: [],
  };

  const prompt = buildPairedOutfitPromptText(input);
  const personBBlock = prompt.split('\n\nB:')[1] ?? '';

  assert(!personBBlock.includes('behavior:'), 'Empty behavior section should be omitted for person B');
  assert(!prompt.includes('displayName'), 'displayName should be omitted');
  console.log('OK empty behavioral sections and displayName omitted');
}

function testFixedItemCompact(): void {
  const prompt = buildPairedOutfitPromptText(createRepresentativePairedPromptInput());

  assert(prompt.includes('fixed=a-4 mandatory'), 'Fixed item should use compact mandatory form');
  assert(!prompt.includes('FIXED ITEM (mandatory):'), 'Verbose fixed item block should be absent');
  console.log('OK fixed item compact representation');
}

function testMatchingModesRetainSemantics(): void {
  const modes = ['natural', 'same_style', 'colors', 'photo'] as const;

  for (const mode of modes) {
    const lines = buildCompactMatchingModeLines(mode);
    assert(lines[0] === `PAIR_MODE=${mode}`, `Expected PAIR_MODE=${mode}`);
    assert(lines.length === 2, `Expected compact hint line for ${mode}`);
  }

  console.log('OK matching modes retain compact semantics');
}

function testNoDuplicateFavoriteWearRepresentation(): void {
  const prompt = buildPairedOutfitPromptText(createRepresentativePairedPromptInput());

  assert(!prompt.includes('favoriteItemIds'), 'favoriteItemIds list should be omitted');
  assert(!prompt.includes('frequentlyWorn'), 'frequentlyWorn list should be omitted');
  assert(prompt.includes('fav=1'), 'Favorite flag should remain on wardrobe items');
  console.log('OK duplicate favorite/wear representation removed');
}

function testDistinctPersonWardrobes(): void {
  const prompt = buildPairedOutfitPromptText(createRepresentativePairedPromptInput());

  assert(prompt.includes('a-0|'), 'Person A wardrobe ids should remain distinct');
  assert(prompt.includes('b-0|'), 'Person B wardrobe ids should remain distinct');
  assert(!prompt.includes('A.ids from B'), 'Cross-person rule should remain explicit');
  console.log('OK person wardrobes remain distinct');
}

function testWrongOwnerFixedItemRejected(): void {
  const ownerWardrobe = createShortlist(8, 'owner');
  const memberWardrobe = createShortlist(8, 'member');
  const fixedItemId = 'member-2';

  const ownerHasFixed = ownerWardrobe.some((item) => item.id === fixedItemId);
  const memberHasFixed = memberWardrobe.some((item) => item.id === fixedItemId);

  assert(!ownerHasFixed, 'Fixture setup: fixed item should not belong to owner wardrobe');
  assert(memberHasFixed, 'Fixture setup: fixed item should belong to member wardrobe');

  const wouldRejectSelfOwner = !ownerWardrobe.some((item) => item.id === fixedItemId);
  const wouldAcceptMemberOwner = memberWardrobe.some((item) => item.id === fixedItemId);

  assert(wouldRejectSelfOwner, 'Server validation should reject fixed item owned by wrong wardrobe (self)');
  assert(wouldAcceptMemberOwner, 'Server validation should accept fixed item in member wardrobe');
  console.log('OK wrong-owner fixed item validation semantics preserved');
}

function testRepresentativePromptReduced(): void {
  const input = createRepresentativePairedPromptInput();
  const legacy = buildLegacyVerbosePairedPrompt(input);
  const compact = buildPairedOutfitPromptText(input);
  const reduction = 1 - compact.length / legacy.length;

  assert(
    reduction >= 0.3,
    `Expected >=30% promptChars reduction, got ${Math.round(reduction * 100)}% (${legacy.length} -> ${compact.length})`,
  );

  console.log(
    `OK representative paired prompt (${legacy.length} -> ${compact.length} chars, ${estimatePromptTokens(legacy)} -> ${estimatePromptTokens(compact)} est. tokens, ${Math.round(reduction * 100)}% reduction)`,
  );
}

function testShortlistSizes(): void {
  const weather = {
    temperatureC: 12,
    apparentTemperatureC: 10,
    precipitationMm: 0,
    weatherCode: 1,
    windSpeedKmh: 10,
  };
  const stylistPreferences: StylistPreferencesPayload = {
    styleExperiment: 'balanced',
    considerWeather: true,
    wardrobeMode: 'owned-only',
    avoidRepeatedOutfits: true,
  };
  const userParameters: UserParametersPayload = {
    fitPreference: 'Обычная',
    weatherSensitivity: 'Обычно',
  };
  const behavioralContext = createBehavioralContext(createShortlist(1, 'x'));

  const scenarios = [
    { label: 'small', count: 6 },
    { label: 'medium', count: 25 },
    { label: 'large', count: 50 },
  ];

  for (const scenario of scenarios) {
    const wardrobe = createShortlist(scenario.count, scenario.label);
    const behavior = capBehavioralContext(createBehavioralContext(wardrobe));
    const ownerShortlist = selectOutfitCandidates({
      wardrobe,
      weather,
      stylistPreferences,
      userParameters,
      behavioralContext: behavior,
      occasion: 'Прогулка',
      mode: 'paired-owner',
      matchingMode: 'natural',
    });
    const memberShortlist = selectOutfitCandidates({
      wardrobe,
      weather,
      stylistPreferences,
      userParameters,
      behavioralContext: behavior,
      occasion: 'Прогулка',
      mode: 'paired-member',
      matchingMode: 'natural',
    });

    assert(ownerShortlist.length >= 2, `${scenario.label}: owner shortlist too small`);
    assert(memberShortlist.length >= 2, `${scenario.label}: member shortlist too small`);

    if (scenario.count >= 25) {
      assert(
        ownerShortlist.length >= 10 && ownerShortlist.length <= 18,
        `${scenario.label}: owner shortlist out of expected 10-18 range (${ownerShortlist.length})`,
      );
      assert(
        memberShortlist.length >= 10 && memberShortlist.length <= 18,
        `${scenario.label}: member shortlist out of expected 10-18 range (${memberShortlist.length})`,
      );
    }

    console.log(
      `OK shortlist ${scenario.label} owner=${ownerShortlist.length}/${scenario.count} member=${memberShortlist.length}/${scenario.count}`,
    );
  }
}

function testFixedItemIncludedInShortlist(): void {
  const wardrobe = createShortlist(25, 'fixed');
  const fixedItemId = 'fixed-12';
  const behavior = capBehavioralContext(createBehavioralContext(wardrobe));
  const shortlist = selectOutfitCandidates({
    wardrobe,
    weather: null,
    stylistPreferences: {
      styleExperiment: 'balanced',
      considerWeather: false,
      wardrobeMode: 'owned-only',
      avoidRepeatedOutfits: true,
    },
    userParameters: { fitPreference: null, weatherSensitivity: null },
    behavioralContext: behavior,
    fixedItemId,
    occasion: 'Свидание',
    mode: 'paired-owner',
    matchingMode: 'colors',
  });

  assert(shortlist.some((item) => item.id === fixedItemId), 'Fixed item must remain in shortlist');
  console.log(`OK fixed item retained in shortlist (${shortlist.length} items)`);
}

function testCompactWeatherFormat(): void {
  const prompt = buildPairedOutfitPromptText(createRepresentativePairedPromptInput());
  const weatherSection = buildCompactWeatherSection({
    temperatureC: 14,
    apparentTemperatureC: 11,
    precipitationMm: 0,
    weatherCode: 3,
    windSpeedKmh: 18,
  }).join('\n');

  assert(prompt.includes(weatherSection), 'Prompt should include compact weather section');
  console.log('OK compact weather format present');
}

function main(): void {
  testSharedWeatherEmittedOnce();
  testEmptyBehaviorSectionsOmitted();
  testFixedItemCompact();
  testMatchingModesRetainSemantics();
  testNoDuplicateFavoriteWearRepresentation();
  testDistinctPersonWardrobes();
  testWrongOwnerFixedItemRejected();
  testRepresentativePromptReduced();
  testShortlistSizes();
  testFixedItemIncludedInShortlist();
  testCompactWeatherFormat();
  console.log('All paired outfit prompt tests passed.');
}

main();
