export type ValidatedWearEventInput = {
  id: string;
  outfitId: string;
  itemIds: string[];
  wornAt: string;
  clientUpdatedAt: string;
};

export type ValidatedWearEventDeleteInput = {
  id: string;
  clientDeletedAt: string;
};

const FORBIDDEN_KEYS = [
  'userId',
  'publicId',
  'originalImageUri',
  'processedImageUri',
  'uri',
  'image',
] as const;

function isIsoTimestamp(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

function hasForbiddenKeys(value: Record<string, unknown>): boolean {
  return FORBIDDEN_KEYS.some((key) => key in value);
}

function normalizeItemIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const itemIds = [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0))];

  if (itemIds.length === 0) {
    return null;
  }

  return itemIds;
}

export function validateWearEventSyncItem(value: unknown): ValidatedWearEventInput | null {
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

  if (typeof data.outfitId !== 'string' || !data.outfitId.trim()) {
    return null;
  }

  const itemIds = normalizeItemIds(data.itemIds);

  if (!itemIds) {
    return null;
  }

  if (typeof data.wornAt !== 'string' || !isIsoTimestamp(data.wornAt)) {
    return null;
  }

  if (typeof data.clientUpdatedAt !== 'string' || !isIsoTimestamp(data.clientUpdatedAt)) {
    return null;
  }

  return {
    id: data.id.trim(),
    outfitId: data.outfitId.trim(),
    itemIds,
    wornAt: data.wornAt,
    clientUpdatedAt: data.clientUpdatedAt,
  };
}

export function validateWearEventDeleteItem(value: unknown): ValidatedWearEventDeleteInput | null {
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
