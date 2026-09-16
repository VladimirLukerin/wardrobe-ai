import { logPhotoDecision, logPrimaryItem } from './photo-processing-error';

export const PHOTO_REJECT_REASONS = {
  MULTIPLE_ITEMS: 'multiple_items',
  ITEM_NOT_CLEAR: 'item_not_clear',
  NOT_CLOTHING: 'not_clothing',
} as const;

export type PhotoRejectReason = (typeof PHOTO_REJECT_REASONS)[keyof typeof PHOTO_REJECT_REASONS];

export type PhotoBackgroundSignal = 'simple' | 'moderate' | 'busy';

export type NormalizedBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function isPhotoRejectReason(value: unknown): value is PhotoRejectReason {
  return (
    value === PHOTO_REJECT_REASONS.MULTIPLE_ITEMS ||
    value === PHOTO_REJECT_REASONS.ITEM_NOT_CLEAR ||
    value === PHOTO_REJECT_REASONS.NOT_CLOTHING
  );
}

export function isPhotoBackgroundSignal(value: unknown): value is PhotoBackgroundSignal {
  return value === 'simple' || value === 'moderate' || value === 'busy';
}

export function isValidNormalizedBoundingBox(
  value: NormalizedBoundingBox | null | undefined,
): value is NormalizedBoundingBox {
  if (!value) {
    return false;
  }

  const { x, y, width, height } = value;

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return false;
  }

  if (width <= 0 || height <= 0) {
    return false;
  }

  if (x < 0 || y < 0) {
    return false;
  }

  if (x + width > 1.000001 || y + height > 1.000001) {
    return false;
  }

  return true;
}

export const PHOTO_CONFIDENCE_ACCEPT = 0.6;
export const PHOTO_CONFIDENCE_BORDERLINE = 0.4;

export type ClothingItemMetadata = {
  baseName: string;
  category: string;
  color: string;
  pattern: string;
  printDescription: string | null;
  style: string;
};

export type PhotoRecognitionSignals = {
  clothingCount: number;
  confidence: number;
  background: PhotoBackgroundSignal;
  primaryItemClear: boolean;
  ambiguousMultipleItems: boolean;
  itemTooSmallOrObscured: boolean;
  item: ClothingItemMetadata | null;
  boundingBox: NormalizedBoundingBox | null;
};

export type PhotoValidationRecognitionResult = {
  accepted: boolean;
  rejectReason: PhotoRejectReason | null;
  rejectMessage: string | null;
  confidence: number;
  item: ClothingItemMetadata | null;
  clothingCount: number;
  primaryItemClear: boolean;
  boundingBox: NormalizedBoundingBox | null;
};

export function getPhotoRejectMessage(reason: PhotoRejectReason): string {
  switch (reason) {
    case PHOTO_REJECT_REASONS.MULTIPLE_ITEMS:
      return 'В кадре несколько вещей. Сфотографируйте одну вещь отдельно.';
    case PHOTO_REJECT_REASONS.ITEM_NOT_CLEAR:
      return 'Вещь плохо видна. Попробуйте снять её целиком и немного ближе.';
    case PHOTO_REJECT_REASONS.NOT_CLOTHING:
      return 'Не удалось распознать одежду на фотографии.';
    default:
      return 'Переснимите вещь.';
  }
}

export function decidePhotoOutcome(signals: PhotoRecognitionSignals): PhotoValidationRecognitionResult {
  const {
    clothingCount,
    confidence,
    background,
    primaryItemClear,
    ambiguousMultipleItems,
    itemTooSmallOrObscured,
    item,
    boundingBox,
  } = signals;

  const boundingBoxValid = isValidNormalizedBoundingBox(boundingBox);

  logPrimaryItem(clothingCount, primaryItemClear);

  let rejectReason: PhotoRejectReason | null = null;

  if (clothingCount === 0 || !item) {
    rejectReason = PHOTO_REJECT_REASONS.NOT_CLOTHING;
  } else if (itemTooSmallOrObscured) {
    rejectReason = PHOTO_REJECT_REASONS.ITEM_NOT_CLEAR;
  } else if (ambiguousMultipleItems) {
    rejectReason = PHOTO_REJECT_REASONS.MULTIPLE_ITEMS;
  } else if (clothingCount > 1 && (!primaryItemClear || !boundingBoxValid)) {
    rejectReason = PHOTO_REJECT_REASONS.MULTIPLE_ITEMS;
  } else if (!primaryItemClear) {
    rejectReason = PHOTO_REJECT_REASONS.ITEM_NOT_CLEAR;
  } else if (confidence < PHOTO_CONFIDENCE_BORDERLINE) {
    rejectReason = PHOTO_REJECT_REASONS.ITEM_NOT_CLEAR;
  }

  if (rejectReason) {
    logPhotoDecision({
      clothingCount,
      confidence,
      background,
      decision: 'reject',
      reason: rejectReason,
    });

    return {
      accepted: false,
      rejectReason,
      rejectMessage: getPhotoRejectMessage(rejectReason),
      confidence,
      item: null,
      clothingCount,
      primaryItemClear,
      boundingBox: null,
    };
  }

  logPhotoDecision({
    clothingCount,
    confidence,
    background,
    decision: 'accept',
    reason: confidence >= PHOTO_CONFIDENCE_ACCEPT ? 'confidence_ok' : 'borderline_clear_item',
  });

  return {
    accepted: true,
    rejectReason: null,
    rejectMessage: null,
    confidence,
    item,
    clothingCount,
    primaryItemClear,
    boundingBox: boundingBoxValid ? boundingBox : null,
  };
}
