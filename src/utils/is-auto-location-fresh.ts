import type { AutoLocation } from '@/constants/body-parameters';
import { LOCATION_CACHE_TTL_MS } from '@/constants/location-cache';

export function isAutoLocationFresh(
  location: AutoLocation | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!location) {
    return false;
  }

  if (typeof location.updatedAt !== 'number') {
    return true;
  }

  return now - location.updatedAt < LOCATION_CACHE_TTL_MS;
}
