const IMAGE_PROCESSING_STATUSES = ['idle', 'processing', 'completed', 'failed'] as const;

export type ValidatedWardrobeItemInput = {
  id: string;
  name: string;
  baseName: string;
  category: string;
  color: string;
  pattern: string;
  printDescription: string | null;
  style: string;
  isFavorite: boolean;
  imageProcessingStatus: (typeof IMAGE_PROCESSING_STATUSES)[number] | null;
  clientUpdatedAt: string;
};

export type ValidatedWardrobeDeleteInput = {
  id: string;
  clientDeletedAt: string;
};

const FORBIDDEN_KEYS = [
  'originalImageUri',
  'processedImageUri',
  'uri',
  'userId',
  'publicId',
] as const;

function isIsoTimestamp(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

function hasForbiddenKeys(value: Record<string, unknown>): boolean {
  return FORBIDDEN_KEYS.some((key) => key in value);
}

function isImageProcessingStatus(value: unknown): value is (typeof IMAGE_PROCESSING_STATUSES)[number] {
  return typeof value === 'string' && IMAGE_PROCESSING_STATUSES.includes(value as never);
}

export function validateWardrobeSyncItem(value: unknown): ValidatedWardrobeItemInput | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const data = value as Record<string, unknown>;

  if (hasForbiddenKeys(data)) {
    return null;
  }

  if (typeof data.id !== 'string' || !data.id.trim()) {
    return null;
  }

  if (typeof data.name !== 'string' || !data.name.trim()) {
    return null;
  }

  if (typeof data.baseName !== 'string' || !data.baseName.trim()) {
    return null;
  }

  if (typeof data.category !== 'string' || !data.category.trim()) {
    return null;
  }

  if (typeof data.color !== 'string' || !data.color.trim()) {
    return null;
  }

  if (typeof data.pattern !== 'string' || !data.pattern.trim()) {
    return null;
  }

  if (typeof data.style !== 'string' || !data.style.trim()) {
    return null;
  }

  if (data.printDescription !== null && typeof data.printDescription !== 'string') {
    return null;
  }

  if (typeof data.isFavorite !== 'boolean') {
    return null;
  }

  if (
    data.imageProcessingStatus !== null &&
    data.imageProcessingStatus !== undefined &&
    !isImageProcessingStatus(data.imageProcessingStatus)
  ) {
    return null;
  }

  if (typeof data.clientUpdatedAt !== 'string' || !isIsoTimestamp(data.clientUpdatedAt)) {
    return null;
  }

  return {
    id: data.id.trim(),
    name: data.name.trim(),
    baseName: data.baseName.trim(),
    category: data.category.trim(),
    color: data.color.trim(),
    pattern: data.pattern.trim(),
    printDescription:
      typeof data.printDescription === 'string' ? data.printDescription.trim() || null : null,
    style: data.style.trim(),
    isFavorite: data.isFavorite,
    imageProcessingStatus: isImageProcessingStatus(data.imageProcessingStatus)
      ? data.imageProcessingStatus
      : null,
    clientUpdatedAt: data.clientUpdatedAt,
  };
}

export function validateWardrobeDeleteItem(value: unknown): ValidatedWardrobeDeleteInput | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const data = value as Record<string, unknown>;

  if (hasForbiddenKeys(data)) {
    return null;
  }

  if (typeof data.id !== 'string' || !data.id.trim()) {
    return null;
  }

  const deletedAt =
    typeof data.clientDeletedAt === 'string'
      ? data.clientDeletedAt
      : typeof data.deletedAt === 'string'
        ? data.deletedAt
        : null;

  if (!deletedAt || !isIsoTimestamp(deletedAt)) {
    return null;
  }

  return {
    id: data.id.trim(),
    clientDeletedAt: deletedAt,
  };
}
