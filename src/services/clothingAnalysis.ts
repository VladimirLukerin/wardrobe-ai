import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';

import { ANALYZE_CLOTHING_ENDPOINT } from '@/config/api';
import {
  MOCK_WARDROBE_DEFAULTS,
  WARDROBE_CATEGORIES,
  WARDROBE_COLORS,
  WARDROBE_PATTERNS,
  WARDROBE_STYLES,
} from '@/constants/wardrobe-options';
import { buildClothingDisplayName } from '@/utils/build-clothing-display-name';

export type ClothingAnalysisResult = {
  name: string;
  baseName: string;
  category: string;
  color: string;
  pattern: string;
  printDescription: string | null;
  style: string;
  confidence?: number;
};

export type ClothingAnalysisErrorCode = 'network' | 'server';

export class ClothingAnalysisError extends Error {
  readonly code: ClothingAnalysisErrorCode;

  constructor(code: ClothingAnalysisErrorCode, message?: string) {
    super(message);
    this.name = 'ClothingAnalysisError';
    this.code = code;
  }
}

export const LOW_CONFIDENCE_THRESHOLD = 0.6;

function pickOption<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === 'string' && options.includes(value as T) ? (value as T) : fallback;
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

function parseAnalysisResponse(data: unknown): ClothingAnalysisResult {
  if (typeof data !== 'object' || data === null) {
    throw new ClothingAnalysisError('server');
  }

  const payload = data as Record<string, unknown>;

  if (typeof payload.error === 'string') {
    throw new ClothingAnalysisError('server', payload.error);
  }

  const baseName =
    typeof payload.baseName === 'string' && payload.baseName.trim().length > 0
      ? payload.baseName.trim()
      : typeof payload.name === 'string' && payload.name.trim().length > 0
        ? payload.name.trim()
        : MOCK_WARDROBE_DEFAULTS.baseName;

  const category = pickOption(payload.category, WARDROBE_CATEGORIES, MOCK_WARDROBE_DEFAULTS.category);
  const color = pickOption(payload.color, WARDROBE_COLORS, MOCK_WARDROBE_DEFAULTS.color);
  const pattern = pickOption(payload.pattern, WARDROBE_PATTERNS, MOCK_WARDROBE_DEFAULTS.pattern);
  const style = pickOption(payload.style, WARDROBE_STYLES, MOCK_WARDROBE_DEFAULTS.style);
  const printDescription = parsePrintDescription(payload.printDescription);

  const confidence =
    typeof payload.confidence === 'number' && Number.isFinite(payload.confidence)
      ? Math.min(1, Math.max(0, payload.confidence))
      : undefined;

  const name =
    buildClothingDisplayName({
      baseName,
      color,
      pattern,
      printDescription,
    }) || MOCK_WARDROBE_DEFAULTS.name;

  return {
    name,
    baseName,
    category,
    color,
    pattern,
    printDescription,
    style,
    confidence,
  };
}

function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    return (
      message.includes('network request failed') ||
      message.includes('failed to fetch') ||
      message.includes('network error') ||
      message.includes('timeout')
    );
  }

  return false;
}

export async function analyzeClothingImage(imageUri: string): Promise<ClothingAnalysisResult> {
  if (!imageUri) {
    throw new ClothingAnalysisError('server', 'Image URI is required');
  }

  const file = new File(imageUri);
  const formData = new FormData();

  formData.append('image', file);

  let response: Response;

  console.log('[AI] Starting clothing analysis');
  console.log('[AI] Endpoint:', ANALYZE_CLOTHING_ENDPOINT);
  console.log('[AI] Image URI:', imageUri);
  console.log('[AI] File URI:', file.uri);
  console.log('[AI] File exists:', file.exists);
  console.log('[AI] File size:', file.size);

  try {
    response = await fetch(ANALYZE_CLOTHING_ENDPOINT, {
      method: 'POST',
      body: formData,
    });
  } catch (error) {
    console.error('[AI] Request failed:', error);

    if (isNetworkFailure(error)) {
      throw new ClothingAnalysisError('network');
    }

    throw new ClothingAnalysisError('server');
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    if (!response.ok) {
      throw new ClothingAnalysisError('server');
    }

    throw new ClothingAnalysisError('server');
  }

  if (!response.ok) {
    throw new ClothingAnalysisError('server');
  }

  return parseAnalysisResponse(payload);
}
