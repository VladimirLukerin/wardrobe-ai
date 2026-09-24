import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const AUTH_TOKEN_KEY = 'wardrobe-ai.auth.session-token';

async function readFallbackToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

async function writeFallbackToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    // Ignore fallback persistence errors.
  }
}

async function clearFallbackToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Ignore fallback persistence errors.
  }
}

export async function getAuthToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return readFallbackToken();
  }

  try {
    return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  } catch {
    return readFallbackToken();
  }
}

export async function setAuthToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    await writeFallbackToken(token);
    return;
  }

  try {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  } catch {
    await writeFallbackToken(token);
  }
}

export async function clearAuthToken(): Promise<void> {
  if (Platform.OS === 'web') {
    await clearFallbackToken();
    return;
  }

  try {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  } catch {
    await clearFallbackToken();
  }
}
