import AsyncStorage from '@react-native-async-storage/async-storage';

const PHOTO_ONBOARDING_KEY = '@wardrobe-ai/photo-onboarding/skip';

export async function shouldShowPhotoCaptureOnboarding(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(PHOTO_ONBOARDING_KEY);
    return value !== 'true';
  } catch {
    return true;
  }
}

export async function setPhotoCaptureOnboardingSkipped(skip: boolean): Promise<void> {
  try {
    if (skip) {
      await AsyncStorage.setItem(PHOTO_ONBOARDING_KEY, 'true');
      return;
    }

    await AsyncStorage.removeItem(PHOTO_ONBOARDING_KEY);
  } catch {
    // Ignore storage failures.
  }
}
