/**
 * Backend base URL for the Wardrobe AI API.
 *
 * Set EXPO_PUBLIC_API_URL in .env for development, for example:
 *   EXPO_PUBLIC_API_URL=http://192.168.1.42:3000
 *
 * Use your Ubuntu machine's LAN IP — localhost will not work on a physical iPhone.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://192.168.1.100:3000';

console.log('[API] API_BASE_URL:', API_BASE_URL);

export const ANALYZE_CLOTHING_ENDPOINT = `${API_BASE_URL}/analyze-clothing`;
export const PROCESS_CLOTHING_IMAGE_ENDPOINT = `${API_BASE_URL}/process-clothing-image`;
export const SUGGEST_OUTFITS_ENDPOINT = `${API_BASE_URL}/suggest-outfits`;
export const CURRENT_WEATHER_ENDPOINT = `${API_BASE_URL}/current-weather`;
export const ANONYMOUS_AUTH_ENDPOINT = `${API_BASE_URL}/auth/anonymous`;
export const LOGOUT_ENDPOINT = `${API_BASE_URL}/auth/logout`;
export const CURRENT_USER_ENDPOINT = `${API_BASE_URL}/me`;
export const CURRENT_USER_PREFERENCES_ENDPOINT = `${API_BASE_URL}/me/preferences`;
export const WARDROBE_ENDPOINT = `${API_BASE_URL}/me/wardrobe`;
export const WARDROBE_SYNC_ENDPOINT = `${API_BASE_URL}/me/wardrobe/sync`;
export const OUTFITS_ENDPOINT = `${API_BASE_URL}/me/outfits`;
export const OUTFITS_SYNC_ENDPOINT = `${API_BASE_URL}/me/outfits/sync`;
export const WEAR_HISTORY_ENDPOINT = `${API_BASE_URL}/me/wear-history`;
export const WEAR_HISTORY_SYNC_ENDPOINT = `${API_BASE_URL}/me/wear-history/sync`;
export const EMAIL_LINK_REQUEST_CODE_ENDPOINT = `${API_BASE_URL}/me/email/request-code`;
export const EMAIL_LINK_VERIFY_ENDPOINT = `${API_BASE_URL}/me/email/verify`;
export const EMAIL_LOGIN_REQUEST_CODE_ENDPOINT = `${API_BASE_URL}/auth/email/request-code`;
export const EMAIL_LOGIN_VERIFY_ENDPOINT = `${API_BASE_URL}/auth/email/verify`;
export const PHONE_LINK_REQUEST_CODE_ENDPOINT = `${API_BASE_URL}/me/phone/request-code`;
export const PHONE_LINK_VERIFY_ENDPOINT = `${API_BASE_URL}/me/phone/verify`;
export const PHONE_LOGIN_REQUEST_CODE_ENDPOINT = `${API_BASE_URL}/auth/phone/request-code`;
export const PHONE_LOGIN_VERIFY_ENDPOINT = `${API_BASE_URL}/auth/phone/verify`;

export function wardrobeOriginalImageUploadEndpoint(itemId: string): string {
  return `${API_BASE_URL}/me/wardrobe/${encodeURIComponent(itemId)}/images/original`;
}

export function wardrobeProcessedImageUploadEndpoint(itemId: string): string {
  return `${API_BASE_URL}/me/wardrobe/${encodeURIComponent(itemId)}/images/processed`;
}

export function wardrobeOriginalImageDownloadEndpoint(itemId: string): string {
  return `${API_BASE_URL}/me/wardrobe/${encodeURIComponent(itemId)}/images/original`;
}

export function wardrobeProcessedImageDownloadEndpoint(itemId: string): string {
  return `${API_BASE_URL}/me/wardrobe/${encodeURIComponent(itemId)}/images/processed`;
}
