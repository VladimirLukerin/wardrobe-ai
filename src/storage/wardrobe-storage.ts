import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  IMAGE_PROCESSING_STATUSES,
  normalizeWardrobeItemImageFields,
  type ImageProcessingStatus,
  type LegacyWardrobeItemImageFields,
  type WardrobeItemImageFields,
} from '@/constants/wardrobe-item';
import type { WardrobeItem } from '@/contexts/wardrobe-context';

const WARDROBE_ITEMS_KEY = '@wardrobe-ai/wardrobe/items';

type StoredWardrobeItem = WardrobeItemImageFields &
  LegacyWardrobeItemImageFields & {
    id?: unknown;
    name?: unknown;
    baseName?: unknown;
    category?: unknown;
    color?: unknown;
    pattern?: unknown;
    printDescription?: unknown;
    style?: unknown;
    isFavorite?: unknown;
  };

function isImageProcessingStatus(value: unknown): value is ImageProcessingStatus {
  return typeof value === 'string' && IMAGE_PROCESSING_STATUSES.includes(value as ImageProcessingStatus);
}

function parsePrintDescription(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function parseWardrobeItem(raw: unknown): WardrobeItem | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const data = raw as StoredWardrobeItem;

  if (typeof data.id !== 'string' || data.id.trim().length === 0) {
    return null;
  }

  const imageFields = normalizeWardrobeItemImageFields(data);

  if (!imageFields.originalImageUri) {
    return null;
  }

  if (!isImageProcessingStatus(data.imageProcessingStatus)) {
    imageFields.imageProcessingStatus = 'idle';
  }

  const name = typeof data.name === 'string' && data.name.trim().length > 0 ? data.name.trim() : 'Новая вещь';
  const baseName =
    typeof data.baseName === 'string' && data.baseName.trim().length > 0
      ? data.baseName.trim()
      : 'Вещь';
  const category = typeof data.category === 'string' ? data.category : 'Другое';
  const color = typeof data.color === 'string' ? data.color : 'Не определён';
  const pattern = typeof data.pattern === 'string' ? data.pattern : 'Без принта';
  const style = typeof data.style === 'string' ? data.style : 'Повседневный';

  return {
    id: data.id,
    ...imageFields,
    name,
    baseName,
    category,
    color,
    pattern,
    printDescription: parsePrintDescription(data.printDescription),
    style,
    isFavorite: data.isFavorite === true,
  };
}

export async function loadWardrobeItems(): Promise<WardrobeItem[]> {
  try {
    const raw = await AsyncStorage.getItem(WARDROBE_ITEMS_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => parseWardrobeItem(item))
      .filter((item): item is WardrobeItem => item !== null);
  } catch {
    return [];
  }
}

export async function saveWardrobeItems(items: WardrobeItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(WARDROBE_ITEMS_KEY, JSON.stringify(items));
  } catch {
    // Keep in-memory state even if persistence fails.
  }
}
