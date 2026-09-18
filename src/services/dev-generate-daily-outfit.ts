import { generateDevDailyOutfit } from '@/services/paired-outfits-storage';
import { getAuthToken } from '@/storage/auth-token-storage';

type DevGenerateDailyOutfitParams = {
  isServerAccount: boolean;
  localDate: string;
  wardrobeItemCount: number;
};

export class DevGenerateDailyOutfitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DevGenerateDailyOutfitError';
  }
}

export async function generateDevDailyOutfitForToday(
  params: DevGenerateDailyOutfitParams,
): Promise<void> {
  if (!__DEV__) {
    throw new DevGenerateDailyOutfitError('DEV daily generation is only available in development builds.');
  }

  if (!params.isServerAccount) {
    throw new DevGenerateDailyOutfitError('Нужен серверный аккаунт.');
  }

  if (params.wardrobeItemCount < 2) {
    throw new DevGenerateDailyOutfitError('Недостаточно вещей для образа.');
  }

  const token = await getAuthToken();

  if (!token) {
    throw new DevGenerateDailyOutfitError('Не удалось получить токен авторизации.');
  }

  console.log(`[DEV DAILY] generate start date=${params.localDate}`);

  try {
    await generateDevDailyOutfit(token, params.localDate);
    console.log('[DEV DAILY] generate success');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.log(`[DEV DAILY] error=${detail}`);
    throw error;
  }
}
