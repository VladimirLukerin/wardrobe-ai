import sharp from 'sharp';

/** Transparent padding as a fraction of the trimmed garment's larger side (5–8%). */
const PADDING_RATIO = 0.065;

/** Alpha similarity threshold for trim — keeps anti-aliased garment edges intact. */
const TRIM_THRESHOLD = 10;

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 } as const;

/**
 * Trims excess transparent canvas from a remove.bg PNG, then adds a small
 * transparent margin so sleeves, hems, and shoe edges do not touch the border.
 *
 * Preserves original garment pixels and aspect ratio — no fixed square canvas.
 */
export async function normalizeProcessedClothingImage(pngBuffer: Buffer): Promise<Buffer> {
  const trimmed = await sharp(pngBuffer)
    .trim({ background: TRANSPARENT, threshold: TRIM_THRESHOLD })
    .png()
    .toBuffer();

  const metadata = await sharp(trimmed).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width === 0 || height === 0) {
    return pngBuffer;
  }

  const padding = Math.max(1, Math.round(Math.max(width, height) * PADDING_RATIO));

  return sharp(trimmed)
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: TRANSPARENT,
    })
    .png()
    .toBuffer();
}
