export const OUTFIT_FEEDBACK_RATINGS = ['like', 'dislike'] as const;

export type OutfitFeedbackRating = (typeof OUTFIT_FEEDBACK_RATINGS)[number];

export const OUTFIT_FEEDBACK_REASONS = [
  'combination_disliked',
  'too_familiar',
  'too_unusual',
  'weather_mismatch',
  'item_disliked',
  'other',
] as const;

export type OutfitFeedbackReason = (typeof OUTFIT_FEEDBACK_REASONS)[number];

export const OUTFIT_FEEDBACK_REASON_LABELS: Record<OutfitFeedbackReason, string> = {
  combination_disliked: 'Не нравится сочетание',
  too_familiar: 'Слишком привычно',
  too_unusual: 'Слишком необычно',
  weather_mismatch: 'Не подходит по погоде',
  item_disliked: 'Не хочу эту вещь',
  other: 'Другое',
};

export type OutfitFeedback = {
  recommendationKey: string;
  itemIds: string[];
  rating: OutfitFeedbackRating;
  reason: OutfitFeedbackReason | null;
  createdAt: string;
  updatedAt: string;
};

export type SaveOutfitFeedbackInput = {
  itemIds: string[];
  rating: OutfitFeedbackRating;
  reason?: OutfitFeedbackReason;
};
