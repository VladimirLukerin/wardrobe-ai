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
