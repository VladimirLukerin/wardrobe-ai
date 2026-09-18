export function shortWardrobeItemId(itemId: string): string {
  const dashIndex = itemId.indexOf('-');

  if (dashIndex > 0) {
    return itemId.slice(0, dashIndex);
  }

  return itemId.slice(0, 12);
}
