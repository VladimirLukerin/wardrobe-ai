import type { SavedOutfit } from '@/constants/saved-outfit';
import type { WearEvent } from '@/constants/wear-event';

export const HOME_WORN_OUTFIT_FEED_LIMIT = 10;

export const WORN_OUTFIT_FALLBACK_TITLE = 'Образ';

export type WornOutfitFeedWearer = {
  type: 'self' | 'family';
  publicId: string | null;
  displayName: string;
};

export type WornOutfitFeedEntry = {
  id: string;
  wearer: WornOutfitFeedWearer;
  outfitId: string;
  itemIds: string[];
  title: string;
  wornAt: string;
  source: 'self' | 'family';
  canNavigate: boolean;
  memberPublicId?: string;
};

export type SelfWearFeedInput = {
  events: WearEvent[];
  savedOutfits: SavedOutfit[];
};

export type FamilyWearFeedMemberInput = {
  memberPublicId: string;
  displayName: string;
  events: Array<{
    id: string;
    outfitId: string;
    itemIds: string[];
    wornAt: string;
  }>;
  outfitTitlesById: Map<string, string>;
};

export function dedupeWearEventItemIds(itemIds: string[]): string[] {
  return [...new Set(itemIds)];
}

export function buildWornOutfitFeed(
  self: SelfWearFeedInput,
  familyMembers: FamilyWearFeedMemberInput[],
  limit = HOME_WORN_OUTFIT_FEED_LIMIT,
): WornOutfitFeedEntry[] {
  const savedOutfitById = new Map(self.savedOutfits.map((outfit) => [outfit.id, outfit]));

  const selfEntries: WornOutfitFeedEntry[] = self.events.map((event) => {
    const savedOutfit = savedOutfitById.get(event.outfitId);

    return {
      id: event.id,
      wearer: {
        type: 'self',
        publicId: null,
        displayName: 'Вы',
      },
      outfitId: event.outfitId,
      itemIds: event.itemIds,
      title: savedOutfit?.title ?? WORN_OUTFIT_FALLBACK_TITLE,
      wornAt: event.wornAt,
      source: 'self',
      canNavigate: Boolean(savedOutfit),
    };
  });

  const familyEntries: WornOutfitFeedEntry[] = familyMembers.flatMap((member) =>
    member.events.map((event) => {
      const savedTitle = member.outfitTitlesById.get(event.outfitId);

      return {
        id: `${member.memberPublicId}:${event.id}`,
        wearer: {
          type: 'family',
          publicId: member.memberPublicId,
          displayName: member.displayName,
        },
        outfitId: event.outfitId,
        itemIds: event.itemIds,
        title: savedTitle ?? WORN_OUTFIT_FALLBACK_TITLE,
        wornAt: event.wornAt,
        source: 'family',
        canNavigate: Boolean(savedTitle),
        memberPublicId: member.memberPublicId,
      };
    }),
  );

  return [...selfEntries, ...familyEntries]
    .filter((entry) => entry.itemIds.length > 0)
    .sort((left, right) => new Date(right.wornAt).getTime() - new Date(left.wornAt).getTime())
    .slice(0, limit);
}
