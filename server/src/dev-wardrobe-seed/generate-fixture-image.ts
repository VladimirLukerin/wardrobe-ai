import crypto from 'crypto';

import sharp from 'sharp';

import type {
  FixtureImageMetadata,
  FixturePatternKind,
  FixtureSilhouetteType,
} from './fixture-image-types';
import { FIXTURE_CANVAS_SIZE } from './fixture-image-types';

const COLOR_BY_NAME: Record<string, string> = {
  'чёрный': '#1F1F1F',
  'черный': '#1F1F1F',
  'белый': '#F5F5F5',
  'серый': '#8E8E93',
  'синий': '#4A90D9',
  'голубой': '#A8C5E8',
  'зелёный': '#4F7942',
  'зеленый': '#4F7942',
  'красный': '#C0392B',
  'бежевый': '#D8CFC4',
  'коричневый': '#7B5E42',
  'жёлтый': '#F4D03F',
  'желтый': '#F4D03F',
  'другой': '#9B59B6',
  'не определён': '#B0B0B0',
  'не определен': '#B0B0B0',
};

const COLOR_BY_FIXTURE_TOKEN: Record<string, string> = {
  black: '#1F1F1F',
  white: '#F5F5F5',
  gray: '#8E8E93',
  grey: '#8E8E93',
  navy: '#1E3A5F',
  blue: '#4A90D9',
  light: '#A8C5E8',
  beige: '#D8CFC4',
  brown: '#7B5E42',
  green: '#4F7942',
  red: '#C0392B',
  coral: '#FF6F61',
  purple: '#7D3C98',
  yellow: '#F4D03F',
  gold: '#D4AF37',
  neon: '#39FF14',
  leopard: '#C49A6C',
  linen: '#D8CFC4',
};

function hashFixtureId(fixtureId: string): number {
  const digest = crypto.createHash('sha256').update(fixtureId).digest();

  return digest.readUInt32BE(0);
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');

  if (normalized.length !== 6) {
    return { r: 176, g: 176, b: 176 };
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function toHexColor({ r, g, b }: { r: number; g: number; b: number }): string {
  const channels = [r, g, b].map((channel) => clampChannel(channel).toString(16).padStart(2, '0'));

  return `#${channels.join('')}`;
}

export function adjustFixtureColor(hex: string, amount: number): string {
  const { r, g, b } = parseHexColor(hex);

  return toHexColor({
    r: r + amount,
    g: g + amount,
    b: b + amount,
  });
}

export function resolveFixtureColor(metadata: FixtureImageMetadata): string {
  const normalizedColor = metadata.color.trim().toLowerCase();
  const named = COLOR_BY_NAME[normalizedColor];

  if (named) {
    return named;
  }

  const token = metadata.fixtureId.split('-')[0]?.toLowerCase();

  if (token && COLOR_BY_FIXTURE_TOKEN[token]) {
    return COLOR_BY_FIXTURE_TOKEN[token];
  }

  const hash = hashFixtureId(metadata.fixtureId);

  return toHexColor({
    r: 80 + (hash % 120),
    g: 80 + ((hash >> 8) % 120),
    b: 80 + ((hash >> 16) % 120),
  });
}

export function resolveFixturePatternKind(metadata: FixtureImageMetadata): FixturePatternKind {
  const pattern = metadata.pattern.trim().toLowerCase();
  const description = metadata.printDescription?.trim().toLowerCase() ?? '';
  const fixtureId = metadata.fixtureId.toLowerCase();

  if (pattern.includes('без принта') || pattern.includes('однотон')) {
    return 'solid';
  }

  if (pattern.includes('полоск') || fixtureId.includes('striped') || fixtureId.includes('stripe')) {
    return 'stripes';
  }

  if (pattern.includes('клет') || fixtureId.includes('plaid')) {
    return 'plaid';
  }

  if (
    pattern.includes('принт') ||
    pattern.includes('горош') ||
    pattern.includes('камуф') ||
    pattern.includes('градиент') ||
    description.length > 0 ||
    fixtureId.includes('graphic') ||
    fixtureId.includes('leopard')
  ) {
    return 'graphic';
  }

  return 'solid';
}

function includesAny(value: string, tokens: string[]): boolean {
  return tokens.some((token) => value.includes(token));
}

export function resolveFixtureSilhouetteType(metadata: FixtureImageMetadata): FixtureSilhouetteType {
  const category = metadata.category.trim().toLowerCase();
  const baseName = metadata.baseName.trim().toLowerCase();
  const fixtureId = metadata.fixtureId.toLowerCase();
  const combined = `${category} ${baseName} ${fixtureId}`;

  if (category === 'аксессуар' || includesAny(combined, ['аксессуар', 'accessory'])) {
    if (includesAny(combined, ['шарф', 'scarf'])) {
      return 'scarf';
    }

    if (includesAny(combined, ['сумк', 'bag'])) {
      return 'bag';
    }

    if (includesAny(combined, ['ремн', 'belt'])) {
      return 'belt';
    }

    if (includesAny(combined, ['кепк', 'шапк', 'cap', 'hat'])) {
      return 'hat';
    }

    return 'bag';
  }

  if (includesAny(combined, ['футбол', 'майк', 'лонгслив', 'tshirt', 'tee', 'top'])) {
    return 'tshirt';
  }

  if (includesAny(combined, ['рубаш', 'shirt', 'oxford', 'linen'])) {
    return 'shirt';
  }

  if (includesAny(combined, ['свитер', 'sweater'])) {
    return 'sweater';
  }

  if (includesAny(combined, ['худи', 'hoodie'])) {
    return 'hoodie';
  }

  if (includesAny(combined, ['джинс', 'jeans'])) {
    return 'jeans';
  }

  if (includesAny(combined, ['шорт', 'shorts'])) {
    return 'shorts';
  }

  if (includesAny(combined, ['юбк', 'skirt'])) {
    return 'skirt';
  }

  if (includesAny(combined, ['брюк', 'chinos', 'trousers', 'pants'])) {
    return 'trousers';
  }

  if (includesAny(combined, ['пухов', 'puffer'])) {
    return 'puffer';
  }

  if (includesAny(combined, ['пальт', 'coat'])) {
    return 'coat';
  }

  if (includesAny(combined, ['ветров', 'плащ', 'windbreaker', 'raincoat'])) {
    return 'windbreaker';
  }

  if (includesAny(combined, ['курт', 'jacket'])) {
    return 'jacket';
  }

  if (includesAny(combined, ['сандал', 'sandals'])) {
    return 'sandals';
  }

  if (includesAny(combined, ['кроссов', 'кед', 'sneaker', 'canvas'])) {
    return 'sneakers';
  }

  if (includesAny(combined, ['ботин', 'сапог', 'boots'])) {
    return 'boots';
  }

  if (includesAny(combined, ['туфл', 'лофер', 'shoes', 'loafers'])) {
    return 'shoes';
  }

  if (includesAny(combined, ['обув'])) {
    return 'sneakers';
  }

  return 'tshirt';
}

function sanitizeSvgId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '');
}

function buildPatternDefs(
  patternId: string,
  patternKind: FixturePatternKind,
  baseColor: string,
  metadata: FixtureImageMetadata,
): string {
  const accent = adjustFixtureColor(baseColor, baseColor.toLowerCase() === '#f5f5f5' ? -45 : 45);
  const secondary = adjustFixtureColor(baseColor, -30);

  if (patternKind === 'stripes') {
    return `
      <pattern id="${patternId}" patternUnits="userSpaceOnUse" width="24" height="24" patternTransform="rotate(35)">
        <rect width="24" height="24" fill="${baseColor}" />
        <rect x="0" y="0" width="12" height="24" fill="${accent}" opacity="0.85" />
      </pattern>`;
  }

  if (patternKind === 'plaid') {
    return `
      <pattern id="${patternId}" patternUnits="userSpaceOnUse" width="32" height="32">
        <rect width="32" height="32" fill="${baseColor}" />
        <rect x="0" y="0" width="32" height="8" fill="${accent}" opacity="0.75" />
        <rect x="0" y="16" width="32" height="8" fill="${accent}" opacity="0.75" />
        <rect x="0" y="0" width="8" height="32" fill="${secondary}" opacity="0.55" />
        <rect x="16" y="0" width="8" height="32" fill="${secondary}" opacity="0.55" />
      </pattern>`;
  }

  if (patternKind === 'graphic' && metadata.fixtureId.toLowerCase().includes('leopard')) {
    const hash = hashFixtureId(metadata.fixtureId);

    return `
      <pattern id="${patternId}" patternUnits="userSpaceOnUse" width="48" height="48">
        <rect width="48" height="48" fill="${baseColor}" />
        <ellipse cx="12" cy="12" rx="7" ry="5" fill="${secondary}" opacity="0.8" transform="rotate(${hash % 40} 12 12)" />
        <ellipse cx="34" cy="28" rx="8" ry="5" fill="${secondary}" opacity="0.75" transform="rotate(${hash % 50} 34 28)" />
        <ellipse cx="20" cy="38" rx="6" ry="4" fill="${secondary}" opacity="0.7" />
      </pattern>`;
  }

  return '';
}

function resolveFill(
  patternKind: FixturePatternKind,
  patternId: string,
  baseColor: string,
  metadata: FixtureImageMetadata,
): string {
  if (patternKind === 'stripes' || patternKind === 'plaid') {
    return `url(#${patternId})`;
  }

  if (patternKind === 'graphic' && metadata.fixtureId.toLowerCase().includes('leopard')) {
    return `url(#${patternId})`;
  }

  return baseColor;
}

function buildGraphicOverlay(
  metadata: FixtureImageMetadata,
  baseColor: string,
  anchor: { x: number; y: number },
): string {
  const hash = hashFixtureId(metadata.fixtureId);
  const accent = adjustFixtureColor(baseColor, -70);
  const variant = hash % 4;
  const size = 34 + (hash % 16);

  if (variant === 0) {
    return `<circle cx="${anchor.x}" cy="${anchor.y}" r="${size / 2}" fill="${accent}" opacity="0.88" />`;
  }

  if (variant === 1) {
    return `<rect x="${anchor.x - size / 2}" y="${anchor.y - size / 2}" width="${size}" height="${size}" rx="8" fill="${accent}" opacity="0.88" />`;
  }

  if (variant === 2) {
    return `<polygon points="${anchor.x},${anchor.y - size / 2} ${anchor.x + size / 2},${anchor.y + size / 2} ${anchor.x - size / 2},${anchor.y + size / 2}" fill="${accent}" opacity="0.88" />`;
  }

  return `<path d="M ${anchor.x} ${anchor.y - size / 2} L ${anchor.x + size * 0.28} ${anchor.y - size * 0.08} L ${anchor.x + size * 0.45} ${anchor.y + size * 0.35} L ${anchor.x} ${anchor.y + size * 0.18} L ${anchor.x - size * 0.45} ${anchor.y + size * 0.35} L ${anchor.x - size * 0.28} ${anchor.y - size * 0.08} Z" fill="${accent}" opacity="0.88" />`;
}

type SilhouetteSpec = {
  bodyPath: string;
  details?: string[];
  graphicAnchor?: { x: number; y: number };
};

function buildSilhouetteSpec(type: FixtureSilhouetteType): SilhouetteSpec {
  switch (type) {
    case 'tshirt':
      return {
        bodyPath:
          'M 195 210 L 155 270 L 185 285 L 185 530 L 455 530 L 455 285 L 485 270 L 445 210 L 395 228 L 320 200 L 245 228 Z',
        details: ['M 265 205 Q 320 185 375 205 Q 320 225 265 205 Z'],
        graphicAnchor: { x: 320, y: 320 },
      };
    case 'shirt':
      return {
        bodyPath:
          'M 195 220 L 160 275 L 188 290 L 188 530 L 452 530 L 452 290 L 480 275 L 445 220 L 395 238 L 320 210 L 245 238 Z',
        details: [
          'M 285 210 L 320 195 L 355 210 L 345 250 L 295 250 Z',
          'M 320 260 L 320 500',
          'M 305 300 L 335 300',
          'M 305 360 L 335 360',
          'M 305 420 L 335 420',
        ],
        graphicAnchor: { x: 320, y: 340 },
      };
    case 'sweater':
      return {
        bodyPath:
          'M 200 225 L 165 280 L 192 295 L 192 535 L 448 535 L 448 295 L 475 280 L 440 225 L 390 242 L 320 218 L 250 242 Z',
        details: [
          'M 275 220 Q 320 205 365 220 Q 320 245 275 220 Z',
          'M 192 300 L 448 300',
          'M 192 360 L 448 360',
        ],
        graphicAnchor: { x: 320, y: 350 },
      };
    case 'hoodie':
      return {
        bodyPath:
          'M 205 235 L 170 290 L 198 305 L 198 540 L 442 540 L 442 305 L 470 290 L 435 235 L 390 250 L 320 228 L 250 250 Z',
        details: [
          'M 250 235 Q 320 150 390 235 Q 360 260 320 255 Q 280 260 250 235 Z',
          'M 255 360 L 385 360 L 385 430 L 255 430 Z',
        ],
        graphicAnchor: { x: 320, y: 330 },
      };
    case 'jeans':
      return {
        bodyPath:
          'M 235 180 L 405 180 L 430 250 L 405 540 L 345 540 L 320 360 L 295 540 L 235 540 L 210 250 Z',
        details: ['M 320 250 L 320 360', 'M 235 250 L 405 250'],
        graphicAnchor: { x: 320, y: 290 },
      };
    case 'trousers':
      return {
        bodyPath:
          'M 240 180 L 400 180 L 415 250 L 390 540 L 335 540 L 320 360 L 305 540 L 250 540 L 225 250 Z',
        details: ['M 320 250 L 320 360', 'M 240 220 L 400 220'],
        graphicAnchor: { x: 320, y: 280 },
      };
    case 'shorts':
      return {
        bodyPath: 'M 235 220 L 405 220 L 420 290 L 395 390 L 325 390 L 320 320 L 315 390 L 245 390 L 220 290 Z',
        details: ['M 235 260 L 405 260'],
        graphicAnchor: { x: 320, y: 300 },
      };
    case 'skirt':
      return {
        bodyPath: 'M 250 220 L 390 220 L 450 430 L 190 430 Z',
        details: ['M 250 260 L 390 260'],
        graphicAnchor: { x: 320, y: 320 },
      };
    case 'jacket':
      return {
        bodyPath:
          'M 205 230 L 170 285 L 198 300 L 198 520 L 442 520 L 442 300 L 470 285 L 435 230 L 395 248 L 320 225 L 245 248 Z',
        details: [
          'M 320 225 L 280 330 L 320 510',
          'M 320 225 L 360 330 L 320 510',
          'M 245 248 L 280 330',
          'M 395 248 L 360 330',
        ],
        graphicAnchor: { x: 320, y: 340 },
      };
    case 'coat':
      return {
        bodyPath:
          'M 210 210 L 175 270 L 200 285 L 200 560 L 440 560 L 440 285 L 465 270 L 430 210 L 390 228 L 320 205 L 250 228 Z',
        details: ['M 320 205 L 320 560', 'M 250 300 L 390 300'],
        graphicAnchor: { x: 320, y: 340 },
      };
    case 'puffer':
      return {
        bodyPath:
          'M 205 230 L 170 285 L 198 300 L 198 520 L 442 520 L 442 300 L 470 285 L 435 230 L 395 248 L 320 225 L 245 248 Z',
        details: [
          'M 198 320 L 442 320',
          'M 198 380 L 442 380',
          'M 198 440 L 442 440',
          'M 320 225 L 320 520',
        ],
        graphicAnchor: { x: 320, y: 350 },
      };
    case 'windbreaker':
      return {
        bodyPath:
          'M 205 235 L 170 290 L 198 305 L 198 500 L 442 500 L 442 305 L 470 290 L 435 235 L 395 252 L 320 230 L 245 252 Z',
        details: [
          'M 295 235 L 320 250 L 345 235 L 335 270 L 305 270 Z',
          'M 320 270 L 320 500',
        ],
        graphicAnchor: { x: 320, y: 330 },
      };
    case 'sneakers':
      return {
        bodyPath:
          'M 180 360 Q 220 320 320 320 Q 420 320 460 360 L 500 410 Q 510 430 490 440 L 170 440 Q 150 430 160 410 Z',
        details: [
          'M 220 360 L 250 390 L 390 390 L 420 360',
          'M 170 440 L 490 440 L 500 455 L 160 455 Z',
        ],
        graphicAnchor: { x: 320, y: 365 },
      };
    case 'shoes':
      return {
        bodyPath:
          'M 190 360 Q 250 330 320 330 Q 390 330 450 360 L 470 400 Q 475 420 450 425 L 180 425 Q 155 420 160 400 Z',
        details: ['M 180 425 L 470 425 L 478 438 L 172 438 Z'],
        graphicAnchor: { x: 320, y: 370 },
      };
    case 'boots':
      return {
        bodyPath:
          'M 250 170 L 390 170 L 405 250 L 395 430 L 360 430 L 350 300 L 290 300 L 280 430 L 245 430 L 235 250 Z',
        details: [
          'M 250 430 L 390 430 L 400 450 L 240 450 Z',
          'M 290 300 L 350 300',
        ],
        graphicAnchor: { x: 320, y: 280 },
      };
    case 'sandals':
      return {
        bodyPath: 'M 170 400 L 470 400 L 480 430 L 160 430 Z',
        details: [
          'M 220 400 L 240 330 L 260 400',
          'M 300 400 L 320 320 L 340 400',
          'M 380 400 L 400 330 L 420 400',
        ],
        graphicAnchor: { x: 320, y: 385 },
      };
    case 'scarf':
      return {
        bodyPath:
          'M 210 250 Q 260 220 320 250 Q 380 280 430 250 Q 390 320 320 340 Q 250 320 210 250 Z',
        details: [
          'M 240 340 Q 320 390 400 340 Q 360 410 320 430 Q 280 410 240 340 Z',
        ],
        graphicAnchor: { x: 320, y: 310 },
      };
    case 'bag':
      return {
        bodyPath: 'M 220 260 L 420 260 L 440 470 L 200 470 Z',
        details: [
          'M 250 260 Q 250 210 290 210 L 350 210 Q 390 210 390 260',
          'M 290 210 L 290 240',
          'M 350 210 L 350 240',
        ],
        graphicAnchor: { x: 320, y: 360 },
      };
    case 'belt':
      return {
        bodyPath: 'M 150 300 L 490 300 L 490 340 L 150 340 Z',
        details: ['M 300 285 L 340 285 L 340 355 L 300 355 Z'],
        graphicAnchor: { x: 380, y: 320 },
      };
    case 'hat':
      return {
        bodyPath: 'M 240 280 Q 320 210 400 280 L 390 350 Q 320 330 250 350 Z',
        details: ['M 180 350 Q 320 390 460 350 L 450 370 Q 320 410 190 370 Z'],
        graphicAnchor: { x: 320, y: 300 },
      };
    default:
      return {
        bodyPath:
          'M 195 210 L 155 270 L 185 285 L 185 530 L 455 530 L 455 285 L 485 270 L 445 210 L 395 228 L 320 200 L 245 228 Z',
        graphicAnchor: { x: 320, y: 320 },
      };
  }
}

export function buildFixtureSvg(metadata: FixtureImageMetadata): string {
  const silhouette = resolveFixtureSilhouetteType(metadata);
  const patternKind = resolveFixturePatternKind(metadata);
  const baseColor = resolveFixtureColor(metadata);
  const patternId = `pattern-${sanitizeSvgId(metadata.fixtureId)}`;
  const patternDefs = buildPatternDefs(patternId, patternKind, baseColor, metadata);
  const fill = resolveFill(patternKind, patternId, baseColor, metadata);
  const spec = buildSilhouetteSpec(silhouette);
  const stroke = adjustFixtureColor(baseColor, -80);
  const details = (spec.details ?? [])
    .map(
      (path) =>
        `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.65" />`,
    )
    .join('\n');

  const graphic =
    patternKind === 'graphic' &&
    !metadata.fixtureId.toLowerCase().includes('leopard') &&
    spec.graphicAnchor
      ? buildGraphicOverlay(metadata, baseColor, spec.graphicAnchor)
      : '';

  return `
    <svg width="${FIXTURE_CANVAS_SIZE}" height="${FIXTURE_CANVAS_SIZE}" viewBox="0 0 ${FIXTURE_CANVAS_SIZE} ${FIXTURE_CANVAS_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>${patternDefs}</defs>
      <path d="${spec.bodyPath}" fill="${fill}" opacity="0.94" />
      ${details}
      ${graphic}
    </svg>`;
}

export async function renderFixturePng(metadata: FixtureImageMetadata): Promise<Buffer> {
  const svg = buildFixtureSvg(metadata);

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function writeFixturePng(
  metadata: FixtureImageMetadata,
  outputPath: string,
): Promise<void> {
  const buffer = await renderFixturePng(metadata);

  await sharp(buffer).png().toFile(outputPath);
}
