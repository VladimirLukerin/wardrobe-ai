export type SavedOutfitSource = 'ai' | 'manual';

export type SavedOutfit = {
  id: string;
  title: string;
  itemIds: string[];
  description: string;
  createdAt: string;
  updatedAt?: string;
  source?: SavedOutfitSource;
};

export type SaveOutfitInput = {
  title: string;
  itemIds: string[];
  description: string;
  source?: SavedOutfitSource;
};
