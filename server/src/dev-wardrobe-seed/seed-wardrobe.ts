import crypto from 'crypto';

import { upsertSavedOutfit } from '../db/saved-outfits-repository';
import { upsertWearEvent } from '../db/wear-events-repository';
import { upsertWardrobeItem } from '../db/wardrobe-items-repository';
import { copyDevFixtureImagesToWardrobeStorage } from './copy-images';
import { formatStyleTags, loadDevWardrobePreset } from './load-preset';
import { readDevWardrobeSeedRecord, writeDevWardrobeSeedRecord } from './seed-record';
import type { DevWardrobeFixtureItem, DevWardrobeSeedRecord } from './types';
import { DEV_WARDROBE_SEED_MARKER } from './paths';
import { clearDevWardrobeSeedForUser } from './clear-seed';

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function createWearEventsForItem(
  userId: string,
  itemId: string,
  usage: DevWardrobeFixtureItem['usage'],
): string[] {
  const eventIds: string[] = [];
  let wears = 0;
  let lastWornDaysAgo: number | null = null;

  switch (usage) {
    case 'frequent':
      wears = 10 + Math.floor(Math.random() * 5);
      lastWornDaysAgo = Math.floor(Math.random() * 7);
      break;
    case 'regular':
      wears = 3 + Math.floor(Math.random() * 4);
      lastWornDaysAgo = 10 + Math.floor(Math.random() * 30);
      break;
    case 'rare':
      wears = 1;
      lastWornDaysAgo = 45 + Math.floor(Math.random() * 40);
      break;
    case 'never':
    default:
      return eventIds;
  }

  for (let index = 0; index < wears; index += 1) {
    const daysAgo = Math.min(89, (lastWornDaysAgo ?? 0) + index * 8);
    const wornAt = daysAgoIso(daysAgo);
    const eventId = crypto.randomUUID();

    upsertWearEvent(userId, {
      id: eventId,
      outfitId: `dev-seed-outfit-${itemId.slice(0, 8)}`,
      itemIds: [itemId],
      wornAt,
      clientUpdatedAt: wornAt,
    });
    eventIds.push(eventId);
  }

  return eventIds;
}

export type SeedDevWardrobeOptions = {
  userId: string;
  publicId: string;
  preset: string;
  replace: boolean;
};

export type SeedDevWardrobeResult = {
  record: DevWardrobeSeedRecord;
  itemCount: number;
  wearEventCount: number;
  savedOutfitCount: number;
};

export async function seedDevWardrobeForUser(options: SeedDevWardrobeOptions): Promise<SeedDevWardrobeResult> {
  const existingRecord = readDevWardrobeSeedRecord(options.userId);

  if (existingRecord && !options.replace) {
    throw new Error(
      'DEV seed already exists for this user. Use --replace to remove previous seed data first.',
    );
  }

  if (existingRecord && options.replace) {
    await clearDevWardrobeSeedForUser(options.userId);
  }

  const preset = loadDevWardrobePreset(options.preset);
  const now = new Date().toISOString();
  const fixtureIdToItemId = new Map<string, string>();
  const itemIds: string[] = [];
  const fixtureIdByItemId: Record<string, string> = {};
  const imageKeys: string[] = [];
  const wearEventIds: string[] = [];

  for (const item of preset.items) {
    const itemId = crypto.randomUUID();
    fixtureIdToItemId.set(item.fixtureId, itemId);
    fixtureIdByItemId[itemId] = item.fixtureId;
    itemIds.push(itemId);

    upsertWardrobeItem(options.userId, {
      id: itemId,
      name: item.name,
      baseName: item.baseName,
      category: item.category,
      color: item.color,
      pattern: item.pattern,
      printDescription: item.printDescription,
      style: formatStyleTags(item.style),
      isFavorite: item.isFavorite,
      imageProcessingStatus: 'completed',
      clientUpdatedAt: now,
    });

    const keys = await copyDevFixtureImagesToWardrobeStorage({
      userId: options.userId,
      itemId,
      fixture: {
        fixtureId: item.fixtureId,
        image: item.image,
        category: item.category,
        baseName: item.baseName,
        color: item.color,
        pattern: item.pattern,
        printDescription: item.printDescription,
      },
      uploadedAt: now,
    });

    imageKeys.push(keys.originalKey, keys.processedKey);
    wearEventIds.push(...createWearEventsForItem(options.userId, itemId, item.usage));
  }

  const savedOutfitIds: string[] = [];

  for (const outfit of preset.savedOutfits) {
    const mappedItemIds = outfit.fixtureIds
      .map((fixtureId) => fixtureIdToItemId.get(fixtureId))
      .filter((itemId): itemId is string => Boolean(itemId));

    if (mappedItemIds.length < 2) {
      continue;
    }

    const outfitId = crypto.randomUUID();
    savedOutfitIds.push(outfitId);

    upsertSavedOutfit(options.userId, {
      id: outfitId,
      title: outfit.title,
      description: outfit.description,
      source: outfit.source,
      itemIds: mappedItemIds,
      createdAt: now,
      clientUpdatedAt: now,
    });
  }

  const record: DevWardrobeSeedRecord = {
    version: 1,
    marker: DEV_WARDROBE_SEED_MARKER,
    userId: options.userId,
    publicId: options.publicId,
    preset: options.preset,
    seededAt: now,
    itemIds,
    fixtureIdByItemId,
    savedOutfitIds,
    wearEventIds,
    imageKeys,
  };

  writeDevWardrobeSeedRecord(record);

  return {
    record,
    itemCount: itemIds.length,
    wearEventCount: wearEventIds.length,
    savedOutfitCount: savedOutfitIds.length,
  };
}
