export const PHOTO_GUARD_REJECT_REASONS = {
  MULTIPLE_ITEMS: 'multiple_items',
  ITEM_NOT_CLEAR: 'item_not_clear',
  NOT_CLOTHING: 'not_clothing',
} as const;

export type PhotoGuardRejectReason =
  (typeof PHOTO_GUARD_REJECT_REASONS)[keyof typeof PHOTO_GUARD_REJECT_REASONS];

export function isPhotoGuardRejectReason(value: unknown): value is PhotoGuardRejectReason {
  return (
    value === PHOTO_GUARD_REJECT_REASONS.MULTIPLE_ITEMS ||
    value === PHOTO_GUARD_REJECT_REASONS.ITEM_NOT_CLEAR ||
    value === PHOTO_GUARD_REJECT_REASONS.NOT_CLOTHING
  );
}

export function getPhotoGuardRejectMessage(reason: PhotoGuardRejectReason | undefined): string {
  switch (reason) {
    case PHOTO_GUARD_REJECT_REASONS.MULTIPLE_ITEMS:
      return 'В кадре несколько вещей. Сфотографируйте одну вещь отдельно.';
    case PHOTO_GUARD_REJECT_REASONS.ITEM_NOT_CLEAR:
      return 'Вещь плохо видна. Попробуйте снять её целиком и немного ближе.';
    case PHOTO_GUARD_REJECT_REASONS.NOT_CLOTHING:
      return 'Не удалось распознать одежду на фотографии.';
    default:
      return 'Переснимите вещь.';
  }
}
