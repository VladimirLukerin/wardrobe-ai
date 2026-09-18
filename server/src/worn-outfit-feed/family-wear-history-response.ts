import type { FamilyMemberInfo } from '../db/family-repository';
import type { WearEventResponse } from '../db/wear-events-repository';

export const FAMILY_WEAR_HISTORY_LIMIT = 30;

export type FamilyWearHistoryEventResponse = {
  id: string;
  outfitId: string;
  itemIds: string[];
  wornAt: string;
};

export type FamilyWearHistoryResponse = {
  member: FamilyMemberInfo;
  events: FamilyWearHistoryEventResponse[];
};

export function buildFamilyWearHistoryResponse(
  member: FamilyMemberInfo,
  events: WearEventResponse[],
  limit = FAMILY_WEAR_HISTORY_LIMIT,
): FamilyWearHistoryResponse {
  const sortedEvents = [...events]
    .sort(
      (left, right) => new Date(right.wornAt).getTime() - new Date(left.wornAt).getTime(),
    )
    .slice(0, limit)
    .map(({ id, outfitId, itemIds, wornAt }) => ({
      id,
      outfitId,
      itemIds,
      wornAt,
    }));

  return {
    member,
    events: sortedEvents,
  };
}
