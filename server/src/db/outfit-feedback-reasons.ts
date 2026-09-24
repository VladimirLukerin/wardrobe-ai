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

export function isOutfitFeedbackRating(value: unknown): value is OutfitFeedbackRating {
  return typeof value === 'string' && OUTFIT_FEEDBACK_RATINGS.includes(value as OutfitFeedbackRating);
}

export function isOutfitFeedbackReason(value: unknown): value is OutfitFeedbackReason {
  return typeof value === 'string' && OUTFIT_FEEDBACK_REASONS.includes(value as OutfitFeedbackReason);
}
