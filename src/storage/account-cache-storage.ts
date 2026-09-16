import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ServerUser } from '@/services/account';

export const ACCOUNT_CACHE_STORAGE_KEY = '@wardrobe-ai/profile/account-cache';

export const ACCOUNT_VALIDATION_TTL_MS = 24 * 60 * 60 * 1000;

export type AccountCache = {
  user: ServerUser;
  lastAccountValidatedAt: string;
};

function parseAccountCache(raw: unknown): AccountCache | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const data = raw as Partial<AccountCache>;
  const user = data.user;

  if (
    typeof user !== 'object' ||
    user === null ||
    typeof user.id !== 'string' ||
    typeof user.publicId !== 'string' ||
    typeof data.lastAccountValidatedAt !== 'string'
  ) {
    return null;
  }

  return {
    user: user as ServerUser,
    lastAccountValidatedAt: data.lastAccountValidatedAt,
  };
}

export function isAccountCacheFresh(lastAccountValidatedAt: string): boolean {
  const validatedAt = new Date(lastAccountValidatedAt).getTime();

  if (Number.isNaN(validatedAt)) {
    return false;
  }

  return Date.now() - validatedAt < ACCOUNT_VALIDATION_TTL_MS;
}

export async function loadAccountCache(): Promise<AccountCache | null> {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNT_CACHE_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    return parseAccountCache(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveAccountCache(cache: AccountCache): Promise<void> {
  try {
    await AsyncStorage.setItem(ACCOUNT_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Keep in-memory state even if persistence fails.
  }
}

export async function saveValidatedAccountUser(user: ServerUser): Promise<void> {
  await saveAccountCache({
    user,
    lastAccountValidatedAt: new Date().toISOString(),
  });
}

export async function saveCachedAccountUser(user: ServerUser): Promise<void> {
  const existing = await loadAccountCache();

  await saveAccountCache({
    user,
    lastAccountValidatedAt: existing?.lastAccountValidatedAt ?? new Date().toISOString(),
  });
}
