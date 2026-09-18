export type ValidatedSavedOutfitInput = {
  id: string;
  title: string;
  description: string;
  source: 'manual' | 'ai' | null;
  itemIds: string[];
  createdAt: string;
  clientUpdatedAt: string;
};

export type ValidatedSavedOutfitDeleteInput = {
  id: string;
  clientDeletedAt: string;
};

const OUTFIT_SOURCES = ['manual', 'ai'] as const;

const FORBIDDEN_KEYS = ['userId', 'publicId', 'originalImageUri', 'processedImageUri', 'uri'] as const;

function isIsoTimestamp(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

function hasForbiddenKeys(value: Record<string, unknown>): boolean {
  return FORBIDDEN_KEYS.some((key) => key in value);
}

function normalizeSource(value: unknown): 'manual' | 'ai' | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' && OUTFIT_SOURCES.includes(value as (typeof OUTFIT_SOURCES)[number])) {
    return value as 'manual' | 'ai';
  }

  return null;
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

export function validateSavedOutfitSyncItem(value: unknown): ValidatedSavedOutfitInput | null {
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

  if (typeof data.title !== 'string') {
    return null;
  }

  if (typeof data.description !== 'string') {
    return null;
  }

  const itemIds = normalizeItemIds(data.itemIds);

  if (!itemIds) {
    return null;
  }

  if (typeof data.createdAt !== 'string' || !isIsoTimestamp(data.createdAt)) {
    return null;
  }

  if (typeof data.clientUpdatedAt !== 'string' || !isIsoTimestamp(data.clientUpdatedAt)) {
    return null;
  }

  const source = normalizeSource(data.source);

  if (data.source !== null && data.source !== undefined && source === null) {
    return null;
  }

  return {
    id: data.id.trim(),
    title: data.title.trim() || 'Образ',
    description: data.description.trim(),
    source,
    itemIds,
    createdAt: data.createdAt,
    clientUpdatedAt: data.clientUpdatedAt,
  };
}

export function validateSavedOutfitDeleteItem(
  value: unknown,
): ValidatedSavedOutfitDeleteInput | null {
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
