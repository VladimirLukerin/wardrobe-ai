import { getDatabase } from '../db/database';
import { getImageStorage } from '../storage/local-image-storage';
import { deleteDevWardrobeSeedRecord, readDevWardrobeSeedRecord } from './seed-record';

export async function clearDevWardrobeSeedForUser(userId: string): Promise<{
  removedItems: number;
  removedOutfits: number;
  removedWearEvents: number;
  removedImages: number;
}> {
  const record = readDevWardrobeSeedRecord(userId);

  if (!record) {
    return {
      removedItems: 0,
      removedOutfits: 0,
      removedWearEvents: 0,
      removedImages: 0,
    };
  }

  const db = getDatabase();
  const storage = getImageStorage();

  let removedWearEvents = 0;
  let removedOutfits = 0;
  let removedItems = 0;
  let removedImages = 0;

  if (record.wearEventIds.length > 0) {
    const placeholders = record.wearEventIds.map(() => '?').join(', ');
    const result = db
      .prepare(
        `DELETE FROM wear_events
         WHERE user_id = ? AND event_id IN (${placeholders})`,
      )
      .run(userId, ...record.wearEventIds);
    removedWearEvents = result.changes;
  }

  if (record.savedOutfitIds.length > 0) {
    const placeholders = record.savedOutfitIds.map(() => '?').join(', ');
    const result = db
      .prepare(
        `DELETE FROM saved_outfits
         WHERE user_id = ? AND outfit_id IN (${placeholders})`,
      )
      .run(userId, ...record.savedOutfitIds);
    removedOutfits = result.changes;
  }

  if (record.itemIds.length > 0) {
    const placeholders = record.itemIds.map(() => '?').join(', ');
    const result = db
      .prepare(
        `DELETE FROM wardrobe_items
         WHERE user_id = ? AND item_id IN (${placeholders})`,
      )
      .run(userId, ...record.itemIds);
    removedItems = result.changes;
  }

  for (const key of record.imageKeys) {
    try {
      await storage.delete(key);
      removedImages += 1;
    } catch {
      // Ignore missing image files during cleanup.
    }
  }

  deleteDevWardrobeSeedRecord(userId);

  return {
    removedItems,
    removedOutfits,
    removedWearEvents,
    removedImages,
  };
}
