import {
  OutfitCandidateSelectionError,
  selectOutfitCandidates,
} from '../src/outfit-ai/candidate-selection';
import type { BehavioralContextPayload, WardrobeItemPayload } from '../src/suggest-outfits';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function createItem(
  overrides: Partial<WardrobeItemPayload> & Pick<WardrobeItemPayload, 'id' | 'category'>,
): WardrobeItemPayload {
  return {
    name: overrides.name ?? overrides.id,
    color: overrides.color ?? 'чёрный',
    pattern: 'Без принта',
    printDescription: null,
    style: 'casual',
    isFavorite: false,
    wearCount: 0,
    lastWornAt: null,
    ...overrides,
  };
}

function createWardrobe(count: number): WardrobeItemPayload[] {
  const categories = ['футболка', 'джинсы', 'кроссовки', 'куртка', 'сумка'];

  return Array.from({ length: count }, (_, index) =>
    createItem({
      id: `item-${index}`,
      name: `Item ${index}`,
      category: categories[index % categories.length] ?? 'футболка',
      isFavorite: index % 11 === 0,
      wearCount: index % 7,
    }),
  );
}

function baseInput(wardrobe: WardrobeItemPayload[]) {
  const behavioralContext: BehavioralContextPayload = {
    favoriteItemIds: ['item-0'],
    frequentlyWorn: [{ id: 'item-1', wearCount: 8, lastWornAt: '2026-09-01T00:00:00.000Z' }],
    recentManualOutfits: [],
    recentSavedAiOutfits: [],
    recentOutfitSignatures: [],
    outfitFeedback: {
      recentlyLikedItemIds: [],
      recentlyDislikedItemIds: ['item-99'],
      likedCombinations: [],
      dislikedCombinations: [],
      stronglyDislikedItemIds: ['item-98'],
      reasonCounts: {},
    },
  };

  return {
    wardrobe,
    weather: {
      temperatureC: 5,
      apparentTemperatureC: 3,
      precipitationMm: 1,
      weatherCode: 61,
      windSpeedKmh: 20,
    },
    stylistPreferences: {
      styleExperiment: 'balanced' as const,
      considerWeather: true,
      wardrobeMode: 'owned-only' as const,
      avoidRepeatedOutfits: true,
    },
    userParameters: {
      fitPreference: 'Обычная' as const,
      weatherSensitivity: 'Часто мёрзну' as const,
    },
    behavioralContext,
  };
}

function testOwnFixedItemAlwaysInOwnerShortlist(): void {
  const wardrobe = createWardrobe(60);
  const fixedItemId = 'item-25';

  const selected = selectOutfitCandidates({
    ...baseInput(wardrobe),
    fixedItemId,
    mode: 'paired-owner',
    matchingMode: 'natural',
    occasion: 'Прогулка',
  });

  assert(selected.some((item) => item.id === fixedItemId), 'Owner fixed item must stay in shortlist');
  console.log('OK own fixed item stays in owner shortlist');
}

function testMemberFixedItemAlwaysInMemberShortlist(): void {
  const wardrobe = createWardrobe(55);
  const fixedItemId = 'item-30';

  const selected = selectOutfitCandidates({
    ...baseInput(wardrobe),
    fixedItemId,
    mode: 'paired-member',
    matchingMode: 'colors',
    occasion: 'Ресторан',
  });

  assert(selected.some((item) => item.id === fixedItemId), 'Member fixed item must stay in shortlist');
  console.log('OK member fixed item stays in member shortlist');
}

function testMissingFixedItemThrows(): void {
  const wardrobe = createWardrobe(10);

  try {
    selectOutfitCandidates({
      ...baseInput(wardrobe),
      fixedItemId: 'missing-item',
      mode: 'personal-fixed-item',
    });
    throw new Error('Expected OutfitCandidateSelectionError');
  } catch (error) {
    assert(
      error instanceof OutfitCandidateSelectionError,
      'Missing fixed item should throw OutfitCandidateSelectionError',
    );
  }

  console.log('OK missing fixed item throws clear error');
}

function testFixedItemBypassesDislikedExclusion(): void {
  const wardrobe = [
    ...createWardrobe(40),
    createItem({ id: 'item-99', category: 'куртка', name: 'Disliked jacket' }),
  ];

  const selected = selectOutfitCandidates({
    ...baseInput(wardrobe),
    fixedItemId: 'item-99',
    mode: 'personal-fixed-item',
  });

  assert(selected.some((item) => item.id === 'item-99'), 'Fixed disliked item must remain selected');
  assert(!selected.some((item) => item.id === 'item-98'), 'Strongly disliked item stays excluded');
  console.log('OK fixed item bypasses disliked exclusion');
}

function testShortlistSizeIsCompact(): void {
  const selected = selectOutfitCandidates({
    ...baseInput(createWardrobe(120)),
    mode: 'paired-owner',
    matchingMode: 'natural',
    occasion: 'Свидание',
  });

  assert(selected.length <= 35, `Expected compact shortlist, got ${selected.length}`);
  console.log(`OK paired shortlist stays compact (${selected.length} items)`);
}

function main(): void {
  testOwnFixedItemAlwaysInOwnerShortlist();
  testMemberFixedItemAlwaysInMemberShortlist();
  testMissingFixedItemThrows();
  testFixedItemBypassesDislikedExclusion();
  testShortlistSizeIsCompact();
  console.log('All outfit candidate selection tests passed.');
}

main();
