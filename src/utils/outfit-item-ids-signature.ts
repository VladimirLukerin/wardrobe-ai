export function getOutfitItemIdsSignature(itemIds: string[]): string {
  return [...new Set(itemIds)].sort().join('|');
}
