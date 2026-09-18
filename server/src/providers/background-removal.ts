import type { BackgroundRemovalProviderName } from './background-removal-error';
import { removeBackgroundLocally } from './local-background-removal';
import { removeBackgroundWithRemoveBg } from './removebg-background-removal';

export { BackgroundRemovalError } from './background-removal-error';

export function getBackgroundRemovalProvider(): BackgroundRemovalProviderName {
  const value = process.env.BACKGROUND_REMOVAL_PROVIDER?.trim().toLowerCase();

  if (value === 'removebg') {
    return 'removebg';
  }

  return 'local';
}

export async function removeClothingBackground(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<Buffer> {
  if (getBackgroundRemovalProvider() === 'removebg') {
    return removeBackgroundWithRemoveBg(imageBuffer, mimeType);
  }

  return removeBackgroundLocally(imageBuffer, mimeType);
}
