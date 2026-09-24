import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { removeBackground, type Config } from '@imgly/background-removal-node';

import {
  logBackgroundRemovalError,
  logBackgroundRemovalStarted,
  logBackgroundRemovalSuccess,
} from '../photo-processing/photo-processing-error';
import { BackgroundRemovalError } from './background-removal-error';

const require = createRequire(__filename);

let cachedConfig: Config | null = null;

function resolveLocalBackgroundRemovalDistPath(): string {
  try {
    const packageEntry = require.resolve('@imgly/background-removal-node');

    return path.join(path.dirname(packageEntry), '..', 'dist');
  } catch {
    return path.join(
      process.cwd(),
      'node_modules',
      '@imgly/background-removal-node',
      'dist',
    );
  }
}

function getLocalBackgroundRemovalConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const distPath = resolveLocalBackgroundRemovalDistPath();

  cachedConfig = {
    publicPath: `${pathToFileURL(distPath).href}/`,
    model: 'medium',
    output: {
      format: 'image/png',
      quality: 0.9,
    },
    debug: process.env.NODE_ENV !== 'production',
  };

  return cachedConfig;
}

export async function removeBackgroundLocally(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<Buffer> {
  const provider = 'local' as const;

  logBackgroundRemovalStarted(provider);
  const startedAt = Date.now();

  try {
    const config = getLocalBackgroundRemovalConfig();
    const imageBlob = new Blob([new Uint8Array(imageBuffer)], {
      type: mimeType || 'image/jpeg',
    });
    const resultBlob = await removeBackground(imageBlob, config);
    const resultBuffer = Buffer.from(await resultBlob.arrayBuffer());

    logBackgroundRemovalSuccess(provider, Date.now() - startedAt);

    return resultBuffer;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logBackgroundRemovalError(provider, message);

    throw new BackgroundRemovalError(message, 502, provider);
  }
}
