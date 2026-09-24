const TOKEN_STORAGE_KEY = 'prikin_admin_session_token';

export function getStoredAdminToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredAdminToken(token: string): void {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredAdminToken(): void {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}
