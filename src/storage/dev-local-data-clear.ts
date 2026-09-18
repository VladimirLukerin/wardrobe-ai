import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearDevSyncTimestampsAndCache } from '@/storage/dev-sync-cache-clear';
import { clearAllWardrobeLocalImageFiles } from '@/utils/wardrobe-local-image-path';

export const DEV_WARDROBE_LOCAL_DATA_KEYS = [
  '@wardrobe-ai/wardrobe/items',
  '@wardrobe-ai/outfits/saved',
  '@wardrobe-ai/wear-history',
] as const;

export async function clearDevLocalWardrobeData(): Promise<void> {
  await AsyncStorage.multiRemove([...DEV_WARDROBE_LOCAL_DATA_KEYS]);
  await clearDevSyncTimestampsAndCache();
  await clearAllWardrobeLocalImageFiles();

  if (__DEV__) {
    const { Image } = await import('expo-image');
    await Image.clearMemoryCache();
  }
}
