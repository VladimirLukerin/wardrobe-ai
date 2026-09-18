export type DevWardrobeUsage = 'frequent' | 'regular' | 'rare' | 'never';

export type DevWardrobeFixtureItem = {
  fixtureId: string;
  image: string;
  name: string;
  baseName: string;
  category: string;
  color: string;
  pattern: string;
  printDescription: string | null;
  style: string[];
  isFavorite: boolean;
  usage: DevWardrobeUsage;
};

export type DevWardrobeSavedOutfitTemplate = {
  title: string;
  description: string;
  source: 'manual' | 'ai';
  fixtureIds: string[];
};

export type DevWardrobePreset = {
  preset: string;
  items: DevWardrobeFixtureItem[];
  savedOutfits: DevWardrobeSavedOutfitTemplate[];
};

export type DevWardrobeSeedRecord = {
  version: 1;
  marker: 'dev-wardrobe-seed-v1';
  userId: string;
  publicId: string;
  preset: string;
  seededAt: string;
  itemIds: string[];
  fixtureIdByItemId: Record<string, string>;
  savedOutfitIds: string[];
  wearEventIds: string[];
  imageKeys: string[];
};
