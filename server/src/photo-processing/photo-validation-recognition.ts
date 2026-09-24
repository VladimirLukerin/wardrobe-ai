import OpenAI from 'openai';

import {
  decidePhotoOutcome,
  isPhotoBackgroundSignal,
  isValidNormalizedBoundingBox,
  type ClothingItemMetadata,
  type NormalizedBoundingBox,
  type PhotoBackgroundSignal,
  type PhotoRecognitionSignals,
  type PhotoValidationRecognitionResult,
} from './photo-decision';
import { logPhotoValidationStarted, logPhotoAiUsage, PHOTO_VISION_DETAIL } from './photo-processing-error';
import { trackOpenAiResponsesCall } from '../ai-usage/record-ai-usage';

const MODEL = 'gpt-4o';

const CLOTHING_CATEGORIES = [
  'Футболка',
  'Рубашка',
  'Худи',
  'Свитер',
  'Куртка',
  'Брюки',
  'Джинсы',
  'Шорты',
  'Обувь',
  'Аксессуар',
  'Другое',
] as const;

const CLOTHING_COLORS = [
  'Чёрный',
  'Белый',
  'Серый',
  'Синий',
  'Голубой',
  'Зелёный',
  'Красный',
  'Бежевый',
  'Коричневый',
  'Жёлтый',
  'Другой',
  'Не определён',
] as const;

const CLOTHING_STYLES = [
  'Повседневный',
  'Деловой',
  'Спортивный',
  'Вечерний',
  'Универсальный',
] as const;

const CLOTHING_PATTERNS = [
  'Без принта',
  'Принт',
  'Полоска',
  'Клетка',
  'Горошек',
  'Камуфляж',
  'Градиент',
  'Другое',
] as const;

export type { ClothingItemMetadata, PhotoValidationRecognitionResult };

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

function parseItemMetadata(value: unknown): ClothingItemMetadata | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const item = value as Record<string, unknown>;
  const baseName =
    typeof item.baseName === 'string' && item.baseName.trim().length > 0
      ? item.baseName.trim()
      : 'Вещь';

  return {
    baseName,
    category: pickOption(item.category, CLOTHING_CATEGORIES, 'Другое'),
    color: pickOption(item.color, CLOTHING_COLORS, 'Не определён'),
    pattern: pickOption(item.pattern, CLOTHING_PATTERNS, 'Без принта'),
    printDescription: parsePrintDescription(item.printDescription),
    style: pickOption(item.style, CLOTHING_STYLES, 'Универсальный'),
  };
}

function parseBoundingBox(value: unknown): NormalizedBoundingBox | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'object') {
    return null;
  }

  const box = value as Record<string, unknown>;

  const parsed: NormalizedBoundingBox = {
    x: typeof box.x === 'number' ? box.x : Number.NaN,
    y: typeof box.y === 'number' ? box.y : Number.NaN,
    width: typeof box.width === 'number' ? box.width : Number.NaN,
    height: typeof box.height === 'number' ? box.height : Number.NaN,
  };

  return isValidNormalizedBoundingBox(parsed) ? parsed : null;
}

function parseRecognitionSignals(payload: unknown): PhotoRecognitionSignals {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Invalid recognition payload.');
  }

  const data = payload as Record<string, unknown>;
  const clothingCount =
    typeof data.clothingCount === 'number' && Number.isFinite(data.clothingCount)
      ? Math.max(0, Math.round(data.clothingCount))
      : 0;
  const confidence =
    typeof data.confidence === 'number' && Number.isFinite(data.confidence)
      ? Math.min(1, Math.max(0, data.confidence))
      : 0;
  const background: PhotoBackgroundSignal = isPhotoBackgroundSignal(data.background)
    ? data.background
    : 'moderate';

  return {
    clothingCount,
    confidence,
    background,
    primaryItemClear: data.primaryItemClear === true,
    ambiguousMultipleItems: data.ambiguousMultipleItems === true,
    itemTooSmallOrObscured: data.itemTooSmallOrObscured === true,
    item: parseItemMetadata(data.item),
    boundingBox: parseBoundingBox(data.boundingBox),
  };
}

export async function validateAndRecognizeClothingPhoto(
  imageBuffer: Buffer,
  mimeType: string,
  userId: string | null = null,
): Promise<PhotoValidationRecognitionResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured on the server.');
  }

  logPhotoValidationStarted();

  const openai = new OpenAI({ apiKey });
  const imageDataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

  const response = await trackOpenAiResponsesCall({
    userId,
    requestType: 'photo',
    call: () =>
      openai.responses.create({
        model: MODEL,
        input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [
              'Проанализируй фото одежды для MVP-каталога.',
              'Верни сигналы для одной основной вещи и её атрибуты.',
              'clothingCount — сколько отдельных предметов одежды/обуви видно в кадре.',
              'confidence — уверенность в определении ОСНОВНОЙ вещи от 0 до 1.',
              'background — мягкий сигнал о фоне: simple | moderate | busy. Это НЕ причина отклонения.',
              'primaryItemClear=true, если можно уверенно выделить одну основную вещь.',
              'ambiguousMultipleItems=true только если несколько вещей равнозначны и непонятно, какую добавлять.',
              'itemTooSmallOrObscured=true, если основная вещь слишком маленькая, сильно перекрыта или плохо различима.',
              'item — атрибуты основной вещи; null если одежды нет.',
              'НЕ считай проблемой: неоднородный фон, мебель, комнату, тени, неидеальный свет,',
              'небольшие посторонние объекты, неидеальный ракурс.',
              'Если на кровати/полу/в комнате лежит одна хорошо различимая вещь — primaryItemClear=true, ambiguousMultipleItems=false.',
              'baseName — короткое название вещи на русском.',
              'Не прячь всю информацию только в baseName — pattern и printDescription заполняй отдельно.',
              'category, color, pattern и style выбирай строго из допустимых значений.',
              'pattern — тип принта/узора: Без принта, Принт, Полоска, Клетка и т.д.',
              'printDescription — короткое описание принта на русском, если принт различим.',
              'Если принт различим, pattern="Принт" и заполни printDescription.',
              'Если принта нет или он неразличим, pattern="Без принта" и printDescription=null.',
              'Не выдумывай printDescription, если не уверен.',
              'boundingBox — нормализованный прямоугольник ОСНОВНОЙ вещи относительно всего кадра:',
              'x, y, width, height от 0 до 1, где (x,y) — левый верхний угол.',
              'boundingBox должен охватывать всю основную вещь целиком, включая рукава, воротник, низ и края.',
              'Если в кадре несколько вещей — обязательно укажи boundingBox основной вещи.',
              'Если в кадре одна вещь — тоже постарайся указать boundingBox; null только если не уверен.',
            ].join(' '),
          },
          {
            type: 'input_image',
            image_url: imageDataUrl,
            detail: PHOTO_VISION_DETAIL,
          },
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'photo_validation_recognition',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            clothingCount: { type: 'integer' },
            confidence: { type: 'number' },
            background: { type: 'string', enum: ['simple', 'moderate', 'busy'] },
            primaryItemClear: { type: 'boolean' },
            ambiguousMultipleItems: { type: 'boolean' },
            itemTooSmallOrObscured: { type: 'boolean' },
            boundingBox: {
              anyOf: [
                {
                  type: 'object',
                  properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                    width: { type: 'number' },
                    height: { type: 'number' },
                  },
                  required: ['x', 'y', 'width', 'height'],
                  additionalProperties: false,
                },
                { type: 'null' },
              ],
            },
            item: {
              anyOf: [
                {
                  type: 'object',
                  properties: {
                    baseName: { type: 'string' },
                    category: { type: 'string', enum: [...CLOTHING_CATEGORIES] },
                    color: { type: 'string', enum: [...CLOTHING_COLORS] },
                    pattern: { type: 'string', enum: [...CLOTHING_PATTERNS] },
                    printDescription: { type: ['string', 'null'] },
                    style: { type: 'string', enum: [...CLOTHING_STYLES] },
                  },
                  required: [
                    'baseName',
                    'category',
                    'color',
                    'pattern',
                    'printDescription',
                    'style',
                  ],
                  additionalProperties: false,
                },
                { type: 'null' },
              ],
            },
          },
          required: [
            'clothingCount',
            'confidence',
            'background',
            'primaryItemClear',
            'ambiguousMultipleItems',
            'itemTooSmallOrObscured',
            'boundingBox',
            'item',
          ],
          additionalProperties: false,
        },
      },
    },
      }),
  });

  if (process.env.NODE_ENV !== 'production' && response.usage) {
    logPhotoAiUsage({
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      totalTokens: response.usage.total_tokens,
    });
  }

  const outputText = response.output_text;

  if (!outputText) {
    throw new Error('OpenAI returned an empty recognition response.');
  }

  const parsed = JSON.parse(outputText) as unknown;
  const signals = parseRecognitionSignals(parsed);

  return decidePhotoOutcome(signals);
}
