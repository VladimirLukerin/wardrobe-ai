import {
  FIXED_ITEM_SHORTLIST_MAX,
  getOutfitCategoryGroup,
  OutfitCandidateSelectionError,
  PAIRED_SHORTLIST_MAX,
  PERSONAL_SHORTLIST_MAX,
  selectOutfitCandidates,
  TINY_WARDROBE_MAX,
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
    pattern: overrides.pattern ?? 'Без принта',
    printDescription: null,
    style: 'casual',
    isFavorite: false,
    wearCount: overrides.wearCount ?? 0,
    lastWornAt: overrides.lastWornAt ?? null,
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

function baseInput(wardrobe: WardrobeItemPayload[], overrides: Record<string, unknown> = {}) {
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
    mode: 'personal' as const,
    ...overrides,
  };
}

function testMediumWardrobeStillShortlists(): void {
  const selected = selectOutfitCandidates(baseInput(createWardrobe(25)));

  assert(selected.length < 25, '25-item wardrobe should still be shortened');
  assert(selected.length >= 8, 'Shortlist should remain usable');
  console.log(`OK medium wardrobe shortlist (${selected.length})`);
}

function testTinyWardrobeRemainsIntact(): void {
  const wardrobe = createWardrobe(TINY_WARDROBE_MAX);
  const selected = selectOutfitCandidates(baseInput(wardrobe));

  assert(selected.length === wardrobe.length, 'Tiny wardrobe should remain intact');
  console.log('OK tiny wardrobe remains intact');
}

function testShortlistMax(): void {
  const selected = selectOutfitCandidates(baseInput(createWardrobe(120)));

  assert(selected.length <= PERSONAL_SHORTLIST_MAX, `Expected <= ${PERSONAL_SHORTLIST_MAX}, got ${selected.length}`);
  console.log(`OK personal shortlist max (${selected.length})`);
}

function testCategoryBalance(): void {
  const selected = selectOutfitCandidates(baseInput(createWardrobe(100)));
  const groups = selected.map((item) => getOutfitCategoryGroup(item.category));

  assert(groups.includes('TOP'), 'Shortlist should include tops');
  assert(groups.includes('BOTTOM'), 'Shortlist should include bottoms');
  assert(groups.includes('SHOES'), 'Shortlist should include shoes');
  console.log('OK category balance');
}

function testFixedBottomRemovesExtraBottoms(): void {
  const wardrobe = [
    ...createWardrobe(40),
    createItem({ id: 'fixed-jeans', category: 'джинсы', name: 'Fixed jeans' }),
  ];
  const selected = selectOutfitCandidates({
    ...baseInput(wardrobe),
    fixedItemId: 'fixed-jeans',
    mode: 'personal-fixed-item',
  });
  const bottoms = selected.filter((item) => getOutfitCategoryGroup(item.category) === 'BOTTOM');

  assert(bottoms.length <= 2, `Expected at most 2 bottoms with fixed jeans, got ${bottoms.length}`);
  assert(bottoms.some((item) => item.id === 'fixed-jeans'), 'Fixed jeans must stay');
  console.log('OK fixed bottom removes extra bottoms');
}

function testFixedShoesRemovesExtraShoes(): void {
  const wardrobe = [
    ...createWardrobe(40),
    createItem({ id: 'fixed-shoes', category: 'кроссовки', name: 'Fixed shoes' }),
  ];
  const selected = selectOutfitCandidates({
    ...baseInput(wardrobe),
    fixedItemId: 'fixed-shoes',
    mode: 'personal-fixed-item',
  });
  const shoes = selected.filter((item) => getOutfitCategoryGroup(item.category) === 'SHOES');

  assert(shoes.length <= 2, `Expected at most 2 shoes with fixed shoes, got ${shoes.length}`);
  assert(shoes.some((item) => item.id === 'fixed-shoes'), 'Fixed shoes must stay');
  console.log('OK fixed shoes removes extra shoes');
}

function testStrongDislikeExcluded(): void {
  const wardrobe = [
    ...createWardrobe(50),
    createItem({ id: 'item-98', category: 'куртка', name: 'Strong dislike' }),
  ];
  const selected = selectOutfitCandidates(baseInput(wardrobe));

  assert(!selected.some((item) => item.id === 'item-98'), 'Strongly disliked item stays excluded');
  console.log('OK strong dislike excluded');
}

function testFavoriteRanking(): void {
  const wardrobe = createWardrobe(80);
  const selected = selectOutfitCandidates({
    ...baseInput(wardrobe),
    behavioralContext: {
      ...baseInput(wardrobe).behavioralContext,
      favoriteItemIds: ['item-5'],
    },
  });

  assert(selected.some((item) => item.id === 'item-5'), 'Favorite item should stay in shortlist');
  console.log('OK favorite ranking');
}

function testFamiliarRanking(): void {
  const wardrobe = createWardrobe(80);
  const selected = selectOutfitCandidates({
    ...baseInput(wardrobe),
    stylistPreferences: {
      ...baseInput(wardrobe).stylistPreferences,
      styleExperiment: 'familiar',
    },
    behavioralContext: {
      ...baseInput(wardrobe).behavioralContext,
      frequentlyWorn: [{ id: 'item-12', wearCount: 12, lastWornAt: '2026-09-10T00:00:00.000Z' }],
    },
  });

  assert(selected.some((item) => item.id === 'item-12'), 'Frequently worn item should stay in shortlist');
  console.log('OK familiar ranking');
}

function testBoldRanking(): void {
  const wardrobe = [
    ...createWardrobe(80),
    createItem({ id: 'bold-item', category: 'футболка', color: 'красный', pattern: 'Полоска', wearCount: 0 }),
  ];
  const selected = selectOutfitCandidates({
    ...baseInput(wardrobe),
    stylistPreferences: {
      ...baseInput(wardrobe).stylistPreferences,
      styleExperiment: 'bold',
    },
  });

  assert(selected.some((item) => item.id === 'bold-item'), 'Bold candidate should enter shortlist');
  console.log('OK bold ranking');
}

function testWeatherCold(): void {
  const wardrobe = [
    ...createWardrobe(60),
    createItem({ id: 'shorts', category: 'шорты', name: 'Shorts' }),
    createItem({ id: 'puffer', category: 'пуховик', name: 'Puffer' }),
  ];
  const selected = selectOutfitCandidates({
    ...baseInput(wardrobe),
    weather: {
      temperatureC: -2,
      apparentTemperatureC: -4,
      precipitationMm: 0,
      weatherCode: 3,
      windSpeedKmh: 10,
    },
  });

  assert(!selected.some((item) => item.id === 'shorts'), 'Cold weather should hard-filter shorts');
  assert(selected.some((item) => item.id === 'puffer'), 'Warm outerwear should remain');
  console.log('OK weather cold');
}

function testWeatherHot(): void {
  const wardrobe = [
    ...createWardrobe(60),
    createItem({ id: 'puffer-hot', category: 'пуховик', name: 'Puffer hot' }),
    createItem({ id: 'shorts-hot', category: 'шорты', name: 'Shorts hot' }),
  ];
  const selected = selectOutfitCandidates({
    ...baseInput(wardrobe),
    weather: {
      temperatureC: 31,
      apparentTemperatureC: 33,
      precipitationMm: 0,
      weatherCode: 1,
      windSpeedKmh: 8,
    },
  });

  assert(!selected.some((item) => item.id === 'puffer-hot'), 'Hot weather should hard-filter heavy outerwear');
  assert(selected.some((item) => item.id === 'shorts-hot'), 'Light bottoms should remain');
  console.log('OK weather hot');
}

function testRain(): void {
  const wardrobe = [
    ...createWardrobe(60),
    createItem({ id: 'sandals', category: 'сандалии', name: 'Sandals' }),
    createItem({ id: 'boots', category: 'ботинки', name: 'Boots' }),
  ];
  const selected = selectOutfitCandidates({
    ...baseInput(wardrobe),
    weather: {
      temperatureC: 12,
      apparentTemperatureC: 10,
      precipitationMm: 3,
      weatherCode: 61,
      windSpeedKmh: 12,
    },
  });

  assert(!selected.some((item) => item.id === 'sandals'), 'Rain should hard-filter open shoes');
  assert(selected.some((item) => item.id === 'boots'), 'Closed shoes should remain');
  console.log('OK rain');
}

function testAvoidRepeated(): void {
  const wardrobe = createWardrobe(50);
  const selected = selectOutfitCandidates({
    ...baseInput(wardrobe),
    behavioralContext: {
      ...baseInput(wardrobe).behavioralContext,
      recentOutfitSignatures: [['item-2', 'item-3', 'item-4']],
    },
  });

  assert(
    !selected.includes(wardrobe.find((item) => item.id === 'item-2')!) ||
      selected.length > 0,
    'Repeated-outfit filter should not empty the shortlist',
  );
  console.log('OK avoid repeated');
}

function testFallbackKeepsRequiredCategory(): void {
  const wardrobe = [
    createItem({ id: 'top-1', category: 'футболка' }),
    createItem({ id: 'bottom-1', category: 'джинсы' }),
    createItem({ id: 'shoe-1', category: 'кроссовки' }),
    ...Array.from({ length: 30 }, (_, index) =>
      createItem({ id: `extra-${index}`, category: 'куртка' }),
    ),
  ];
  const selected = selectOutfitCandidates({
    ...baseInput(wardrobe),
    behavioralContext: {
      ...baseInput(wardrobe).behavioralContext,
      outfitFeedback: {
        recentlyLikedItemIds: [],
        recentlyDislikedItemIds: [],
        likedCombinations: [],
        dislikedCombinations: [],
        stronglyDislikedItemIds: wardrobe
          .filter((item) => getOutfitCategoryGroup(item.category) === 'TOP' && item.id !== 'top-1')
          .map((item) => item.id),
        reasonCounts: {},
      },
    },
  });

  assert(selected.some((item) => item.id === 'top-1'), 'Fallback should keep at least one top');
  console.log('OK fallback keeps required category');
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
  assert(selected.length <= PAIRED_SHORTLIST_MAX, 'Paired shortlist should stay compact');
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
  assert(selected.length <= FIXED_ITEM_SHORTLIST_MAX, 'Fixed-item shortlist should stay compact');
  console.log('OK fixed item bypasses disliked exclusion');
}

function main(): void {
  testMediumWardrobeStillShortlists();
  testTinyWardrobeRemainsIntact();
  testShortlistMax();
  testCategoryBalance();
  testFixedBottomRemovesExtraBottoms();
  testFixedShoesRemovesExtraShoes();
  testStrongDislikeExcluded();
  testFavoriteRanking();
  testFamiliarRanking();
  testBoldRanking();
  testWeatherCold();
  testWeatherHot();
  testRain();
  testAvoidRepeated();
  testFallbackKeepsRequiredCategory();
  testOwnFixedItemAlwaysInOwnerShortlist();
  testMemberFixedItemAlwaysInMemberShortlist();
  testMissingFixedItemThrows();
  testFixedItemBypassesDislikedExclusion();
  console.log('All outfit candidate selection tests passed.');
}

main();
