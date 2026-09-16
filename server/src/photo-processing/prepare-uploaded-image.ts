import sharp from 'sharp';

export type PreparedUploadedImage = {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
};

export async function prepareUploadedImage(
  buffer: Buffer,
  mimeType: string,
): Promise<PreparedUploadedImage> {
  const oriented = sharp(buffer, { failOn: 'none' }).rotate();

  if (mimeType === 'image/png') {
    const { data, info } = await oriented.png().toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      mimeType: 'image/png',
      width: info.width,
      height: info.height,
    };
  }

  if (mimeType === 'image/webp') {
    const { data, info } = await oriented.webp().toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      mimeType: 'image/webp',
      width: info.width,
      height: info.height,
    };
  }

  const { data, info } = await oriented.jpeg({ quality: 92 }).toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    mimeType: 'image/jpeg',
    width: info.width,
    height: info.height,
  };
}
