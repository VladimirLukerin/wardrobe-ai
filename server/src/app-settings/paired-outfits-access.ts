import type { Response } from 'express';

import { arePairedOutfitsEnabled } from './app-settings-service';

export const PAIRED_OUTFITS_DISABLED_MESSAGE = 'Подбор парных образов временно недоступен.';

export const PAIRED_OUTFITS_DISABLED_CODE = 'paired_outfits_disabled';

export function respondIfPairedOutfitsDisabled(res: Response): boolean {
  if (arePairedOutfitsEnabled()) {
    return false;
  }

  res.status(403).json({
    error: PAIRED_OUTFITS_DISABLED_MESSAGE,
    code: PAIRED_OUTFITS_DISABLED_CODE,
  });

  return true;
}
