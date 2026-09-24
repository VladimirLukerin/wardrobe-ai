import {
  buildFamilyWearHistoryResponse,
  FAMILY_WEAR_HISTORY_LIMIT,
} from '../src/worn-outfit-feed/family-wear-history-response';
import {
  buildWornOutfitFeed,
  dedupeWearEventItemIds,
  HOME_WORN_OUTFIT_FEED_LIMIT,
  WORN_OUTFIT_FALLBACK_TITLE,
} from '../../src/utils/build-worn-outfit-feed';
import { collectKnownFamilyItemIdsForMemberCleanup } from '../../src/utils/collect-known-family-item-ids';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function testFamilyWearHistoryLimitAndSort(): void {
  const response = buildFamilyWearHistoryResponse(
    { publicId: 'member-1', displayName: 'Anna' },
    [
      {
        id: 'e1',
        outfitId: 'o1',
        itemIds: ['a', 'b'],
        wornAt: '2026-09-18T08:00:00.000Z',
        updatedAt: '2026-09-18T08:00:00.000Z',
      },
      {
        id: 'e2',
        outfitId: 'o2',
        itemIds: ['c', 'd'],
        wornAt: '2026-09-18T11:00:00.000Z',
        updatedAt: '2026-09-18T11:00:00.000Z',
      },
    ],
    1,
  );

  assert(response.events.length === 1, 'Expected family wear history limit to apply');
  assert(response.events[0]?.id === 'e2', 'Expected newest wear event first');
  assert(response.member.publicId === 'member-1', 'Expected member payload to be preserved');

  console.log('OK family wear history limit and sort');
}

function testBuildWornOutfitFeedSorting(): void {
  const feed = buildWornOutfitFeed(
    {
      events: [
        {
          id: 'self-1',
          outfitId: 'outfit-self',
          itemIds: ['a', 'b'],
          wornAt: '2026-09-18T10:00:00.000Z',
        },
      ],
      savedOutfits: [
        {
          id: 'outfit-self',
          title: 'Self outfit',
          itemIds: ['a', 'b'],
          description: '',
          createdAt: '2026-09-18T09:00:00.000Z',
        },
      ],
    },
    [
      {
        memberPublicId: 'family-1',
        displayName: 'Anna',
        events: [
          {
            id: 'family-1',
            outfitId: 'outfit-family',
            itemIds: ['c', 'd'],
            wornAt: '2026-09-18T11:00:00.000Z',
          },
        ],
        outfitTitlesById: new Map([['outfit-family', 'Family outfit']]),
      },
    ],
  );

  assert(feed[0]?.source === 'family', 'Expected family event above self event');
  assert(feed[0]?.wornAt === '2026-09-18T11:00:00.000Z', 'Expected family wornAt first');

  console.log('OK build worn outfit feed sorting');
}

function testMultipleFamilyMembersOrdering(): void {
  const feed = buildWornOutfitFeed(
    { events: [], savedOutfits: [] },
    [
      {
        memberPublicId: 'family-a',
        displayName: 'Anna',
        events: [
          {
            id: 'a1',
            outfitId: 'oa',
            itemIds: ['1', '2'],
            wornAt: '2026-09-18T09:30:00.000Z',
          },
        ],
        outfitTitlesById: new Map(),
      },
      {
        memberPublicId: 'family-b',
        displayName: 'Bob',
        events: [
          {
            id: 'b1',
            outfitId: 'ob',
            itemIds: ['3', '4'],
            wornAt: '2026-09-18T12:00:00.000Z',
          },
        ],
        outfitTitlesById: new Map(),
      },
    ],
  );

  assert(feed.length === 2, 'Expected both family events');
  assert(feed[0]?.wearer.displayName === 'Bob', 'Expected global wornAt ordering across members');

  console.log('OK multiple family members ordering');
}

function testDeletedSavedOutfitFallback(): void {
  const feed = buildWornOutfitFeed(
    {
      events: [
        {
          id: 'self-deleted',
          outfitId: 'missing-outfit',
          itemIds: ['a', 'b'],
          wornAt: '2026-09-18T10:00:00.000Z',
        },
      ],
      savedOutfits: [],
    },
    [],
  );

  assert(feed.length === 1, 'Expected deleted saved outfit event to remain');
  assert(feed[0]?.title === WORN_OUTFIT_FALLBACK_TITLE, 'Expected fallback title');
  assert(feed[0]?.canNavigate === false, 'Expected deleted outfit to be read-only');

  console.log('OK deleted saved outfit fallback');
}

function testSelfOnlyWithoutFamily(): void {
  const feed = buildWornOutfitFeed(
    {
      events: [
        {
          id: 'self-only',
          outfitId: 'outfit-self',
          itemIds: ['a', 'b'],
          wornAt: '2026-09-18T10:00:00.000Z',
        },
      ],
      savedOutfits: [
        {
          id: 'outfit-self',
          title: 'Self outfit',
          itemIds: ['a', 'b'],
          description: '',
          createdAt: '2026-09-18T09:00:00.000Z',
        },
      ],
    },
    [],
  );

  assert(feed.length === 1, 'Expected self-only feed');
  assert(feed[0]?.wearer.displayName === 'Вы', 'Expected self wearer label');

  console.log('OK self-only without family');
}

function testFeedLimitAfterMerge(): void {
  const familyEvents = Array.from({ length: HOME_WORN_OUTFIT_FEED_LIMIT + 2 }, (_, index) => ({
    id: `event-${index}`,
    outfitId: `outfit-${index}`,
    itemIds: ['a', 'b'],
    wornAt: new Date(Date.UTC(2026, 8, 18, index)).toISOString(),
  }));

  const feed = buildWornOutfitFeed(
    {
      events: [
        {
          id: 'self-old',
          outfitId: 'outfit-self',
          itemIds: ['a', 'b'],
          wornAt: '2026-09-17T10:00:00.000Z',
        },
      ],
      savedOutfits: [],
    },
    [
      {
        memberPublicId: 'family-1',
        displayName: 'Anna',
        events: familyEvents,
        outfitTitlesById: new Map(),
      },
    ],
    HOME_WORN_OUTFIT_FEED_LIMIT,
  );

  assert(feed.length === HOME_WORN_OUTFIT_FEED_LIMIT, 'Expected merged feed limit');

  console.log('OK feed limit after merge');
}

function testDedupeFamilyItemIds(): void {
  const deduped = dedupeWearEventItemIds(['a', 'b', 'a', 'c', 'b']);

  assert(deduped.length === 3, 'Expected duplicate itemIds to be deduped');
  assert(deduped.join(',') === 'a,b,c', 'Expected stable dedupe order');

  console.log('OK dedupe family item ids');
}

function testFamilyWearHistoryDefaultLimit(): void {
  const events = Array.from({ length: FAMILY_WEAR_HISTORY_LIMIT + 5 }, (_, index) => ({
    id: `event-${index}`,
    outfitId: `outfit-${index}`,
    itemIds: ['a', 'b'],
    wornAt: new Date(Date.UTC(2026, 8, 18, 0, index)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 8, 18, 0, index)).toISOString(),
  }));

  const response = buildFamilyWearHistoryResponse(
    { publicId: 'member-1', displayName: 'Anna' },
    events,
  );

  assert(
    response.events.length === FAMILY_WEAR_HISTORY_LIMIT,
    'Expected default family wear history limit',
  );

  console.log('OK family wear history default limit');
}

function testCollectKnownFamilyItemIdsForMemberCleanup(): void {
  const itemIds = collectKnownFamilyItemIdsForMemberCleanup({
    wardrobeSnapshot: {
      member: { publicId: 'member-1', displayName: 'Anna' },
      items: [
        {
          id: 'item-a',
          name: 'Shirt',
          baseName: 'Shirt',
          category: 'Shirt',
          color: 'White',
          pattern: 'Plain',
          printDescription: null,
          style: 'Casual',
          isFavorite: false,
          imageProcessingStatus: 'completed',
          images: {
            originalAvailable: true,
            processedAvailable: true,
            originalUpdatedAt: null,
            processedUpdatedAt: null,
          },
          updatedAt: '2026-09-18T10:00:00.000Z',
          createdAt: '2026-09-18T10:00:00.000Z',
        },
      ],
    },
    wearHistorySnapshot: {
      member: { publicId: 'member-1', displayName: 'Anna' },
      events: [
        {
          id: 'event-1',
          outfitId: 'outfit-1',
          itemIds: ['item-b', 'item-a'],
          wornAt: '2026-09-18T11:00:00.000Z',
        },
      ],
    },
    outfitsSnapshot: {
      member: { publicId: 'member-1', displayName: 'Anna' },
      outfits: [
        {
          id: 'outfit-1',
          title: 'Look',
          description: '',
          source: 'manual',
          itemIds: ['item-c', 'item-b'],
          createdAt: '2026-09-18T09:00:00.000Z',
          updatedAt: '2026-09-18T09:00:00.000Z',
        },
      ],
    },
  });

  assert(itemIds.length === 3, 'Expected deduped known item ids from all family snapshots');
  assert(itemIds.includes('item-a'), 'Expected wardrobe item id');
  assert(itemIds.includes('item-b'), 'Expected wear history item id');
  assert(itemIds.includes('item-c'), 'Expected outfit item id');

  console.log('OK collect known family item ids for cleanup');
}

function main(): void {
  testFamilyWearHistoryLimitAndSort();
  testFamilyWearHistoryDefaultLimit();
  testBuildWornOutfitFeedSorting();
  testMultipleFamilyMembersOrdering();
  testDeletedSavedOutfitFallback();
  testSelfOnlyWithoutFamily();
  testFeedLimitAfterMerge();
  testDedupeFamilyItemIds();
  testCollectKnownFamilyItemIdsForMemberCleanup();
  console.log('All worn-outfit feed checks passed.');
}

main();
