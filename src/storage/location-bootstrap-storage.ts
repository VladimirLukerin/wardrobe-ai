import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_BOOTSTRAP_KEY = '@wardrobe-ai/location-bootstrap/asked';

export async function hasAskedLocationBootstrap(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(LOCATION_BOOTSTRAP_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

export async function markLocationBootstrapAsked(): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCATION_BOOTSTRAP_KEY, 'true');
  } catch {
    // Ignore storage failures — permission can be requested again later.
  }
}
