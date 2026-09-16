import type { SuggestOutfitsLocation } from '@/services/outfit-suggestions';

export function buildLocationKey(location: Pick<SuggestOutfitsLocation, 'latitude' | 'longitude'>): string {
  return `${location.latitude.toFixed(3)},${location.longitude.toFixed(3)}`;
}
