import fs from 'fs';

import type { DevWardrobeFixtureItem, DevWardrobePreset, DevWardrobeSavedOutfitTemplate } from './types';
import { getDevWardrobePresetPath } from './paths';

function isUsage(value: unknown): value is DevWardrobeFixtureItem['usage'] {
  return value === 'frequent' || value === 'regular' || value === 'rare' || value === 'never';
}

function parseFixtureItem(value: unknown): DevWardrobeFixtureItem | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (
    typeof item.fixtureId !== 'string' ||
    typeof item.image !== 'string' ||
    typeof item.name !== 'string' ||
    typeof item.baseName !== 'string' ||
    typeof item.category !== 'string' ||
    typeof item.color !== 'string' ||
    typeof item.pattern !== 'string' ||
    !Array.isArray(item.style) ||
    typeof item.isFavorite !== 'boolean' ||
    !isUsage(item.usage)
  ) {
    return null;
  }

  const style = item.style.filter((entry): entry is string => typeof entry === 'string');

  if (style.length === 0) {
    return null;
  }

  return {
    fixtureId: item.fixtureId.trim(),
    image: item.image.trim(),
    name: item.name.trim(),
    baseName: item.baseName.trim(),
    category: item.category.trim(),
    color: item.color.trim(),
    pattern: item.pattern.trim(),
    printDescription:
      typeof item.printDescription === 'string'
        ? item.printDescription.trim()
        : item.printDescription === null
          ? null
          : null,
    style,
    isFavorite: item.isFavorite,
    usage: item.usage,
  };
}

function parseSavedOutfit(value: unknown): DevWardrobeSavedOutfitTemplate | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const outfit = value as Record<string, unknown>;

  if (typeof outfit.title !== 'string' || typeof outfit.description !== 'string') {
    return null;
  }

  if (outfit.source !== 'manual' && outfit.source !== 'ai') {
    return null;
  }

  if (!Array.isArray(outfit.fixtureIds)) {
    return null;
  }

  const fixtureIds = outfit.fixtureIds.filter(
    (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
  );

  if (fixtureIds.length < 2) {
    return null;
  }

  return {
    title: outfit.title.trim(),
    description: outfit.description.trim(),
    source: outfit.source,
    fixtureIds,
  };
}

export function loadDevWardrobePreset(preset: string): DevWardrobePreset {
  const presetPath = getDevWardrobePresetPath(preset);

  if (!fs.existsSync(presetPath)) {
    throw new Error(`Preset not found: ${presetPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(presetPath, 'utf8')) as Record<string, unknown>;

  if (!Array.isArray(parsed.items)) {
    throw new Error('Invalid preset: items array is required.');
  }

  const items = parsed.items
    .map((entry) => parseFixtureItem(entry))
    .filter((entry): entry is DevWardrobeFixtureItem => entry !== null);

  if (items.length === 0) {
    throw new Error('Invalid preset: no valid items.');
  }

  const savedOutfits = Array.isArray(parsed.savedOutfits)
    ? parsed.savedOutfits
        .map((entry) => parseSavedOutfit(entry))
        .filter((entry): entry is DevWardrobeSavedOutfitTemplate => entry !== null)
    : [];

  return {
    preset,
    items,
    savedOutfits,
  };
}

export function formatStyleTags(style: string[]): string {
  return style
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1))
    .join(', ');
}
