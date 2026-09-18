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
export const FAMILY_ENDPOINT = `${API_BASE_URL}/me/family`;
export const FAMILY_INVITES_ENDPOINT = `${API_BASE_URL}/me/family/invites`;

export function familyInviteEndpoint(inviteId: string): string {
  return `${API_BASE_URL}/me/family/invites/${encodeURIComponent(inviteId)}`;
}

export function familyMemberEndpoint(memberPublicId: string): string {
  return `${API_BASE_URL}/me/family/${encodeURIComponent(memberPublicId)}`;
}

export function familyMemberWardrobeEndpoint(memberPublicId: string): string {
  return `${API_BASE_URL}/me/family/${encodeURIComponent(memberPublicId)}/wardrobe`;
}

export function familyMemberOutfitsEndpoint(memberPublicId: string): string {
  return `${API_BASE_URL}/me/family/${encodeURIComponent(memberPublicId)}/outfits`;
}

export function familyMemberWearHistoryEndpoint(memberPublicId: string): string {
  return `${API_BASE_URL}/me/family/${encodeURIComponent(memberPublicId)}/wear-history`;
}

export function familyMemberPairedOutfitsEndpoint(memberPublicId: string): string {
  return `${API_BASE_URL}/me/family/${encodeURIComponent(memberPublicId)}/paired-outfits`;
}

export const PAIRED_OUTFITS_ENDPOINT = `${API_BASE_URL}/me/paired-outfits`;

export function savedPairedOutfitEndpoint(outfitId: string): string {
  return `${PAIRED_OUTFITS_ENDPOINT}/${encodeURIComponent(outfitId)}`;
}

export function dailyOutfitTodayEndpoint(localDate: string): string {
  const url = new URL(`${API_BASE_URL}/me/daily-outfits/today`);
  url.searchParams.set('localDate', localDate);

  return url.toString();
}

export function dailyOutfitRegenerateEndpoint(): string {
  return `${API_BASE_URL}/me/daily-outfits/today/regenerate`;
}

export const DEV_DAILY_OUTFIT_GENERATE_ENDPOINT = `${API_BASE_URL}/dev/daily-outfit/generate`;

export function outfitFeedbackEndpoint(recommendationKey?: string): string {
  if (recommendationKey) {
    return `${API_BASE_URL}/me/outfit-feedback/${encodeURIComponent(recommendationKey)}`;
  }

  return `${API_BASE_URL}/me/outfit-feedback`;
}

function familyMemberWardrobeImageEndpoint(
  memberPublicId: string,
  path: 'original' | 'processed',
  itemId: string,
): string {
  const url = new URL(
    `${API_BASE_URL}/me/family/${encodeURIComponent(memberPublicId)}/wardrobe/images/${path}`,
  );
  url.searchParams.set('itemId', itemId);

  return url.toString();
}

export function familyMemberWardrobeOriginalImageEndpoint(
  memberPublicId: string,
  itemId: string,
): string {
  return familyMemberWardrobeImageEndpoint(memberPublicId, 'original', itemId);
}

export function familyMemberWardrobeProcessedImageEndpoint(
  memberPublicId: string,
  itemId: string,
): string {
  return familyMemberWardrobeImageEndpoint(memberPublicId, 'processed', itemId);
}

export function familyMemberOriginalImageEndpoint(
  memberPublicId: string,
  itemId: string,
): string {
  return familyMemberWardrobeOriginalImageEndpoint(memberPublicId, itemId);
}

export function familyMemberProcessedImageEndpoint(
  memberPublicId: string,
  itemId: string,
): string {
  return familyMemberWardrobeProcessedImageEndpoint(memberPublicId, itemId);
}

export function familyInviteAcceptEndpoint(inviteId: string): string {
  return `${familyInviteEndpoint(inviteId)}/accept`;
}

export function familyInviteRejectEndpoint(inviteId: string): string {
  return `${familyInviteEndpoint(inviteId)}/reject`;
}

export const EMAIL_LINK_REQUEST_CODE_ENDPOINT = `${API_BASE_URL}/me/email/request-code`;
export const EMAIL_LINK_VERIFY_ENDPOINT = `${API_BASE_URL}/me/email/verify`;
export const EMAIL_LOGIN_REQUEST_CODE_ENDPOINT = `${API_BASE_URL}/auth/email/request-code`;
export const EMAIL_LOGIN_VERIFY_ENDPOINT = `${API_BASE_URL}/auth/email/verify`;
export const EMAIL_LOGIN_DEV_BYPASS_ENDPOINT = `${API_BASE_URL}/auth/email/dev-bypass`;
export const PHONE_LINK_REQUEST_CODE_ENDPOINT = `${API_BASE_URL}/me/phone/request-code`;
export const PHONE_LINK_VERIFY_ENDPOINT = `${API_BASE_URL}/me/phone/verify`;
export const PHONE_LINK_DEV_BYPASS_ENDPOINT = `${API_BASE_URL}/me/phone/dev-bypass`;
export const PHONE_LOGIN_REQUEST_CODE_ENDPOINT = `${API_BASE_URL}/auth/phone/request-code`;
export const PHONE_LOGIN_VERIFY_ENDPOINT = `${API_BASE_URL}/auth/phone/verify`;
export const PHONE_LOGIN_DEV_BYPASS_ENDPOINT = `${API_BASE_URL}/auth/phone/dev-bypass`;
export const EMAIL_LINK_DEV_BYPASS_ENDPOINT = `${API_BASE_URL}/me/email/dev-bypass`;
export const PASSWORD_LOGIN_ENDPOINT = `${API_BASE_URL}/auth/password/login`;
export const PASSWORD_RESET_REQUEST_CODE_ENDPOINT = `${API_BASE_URL}/auth/password/reset/request-code`;
export const PASSWORD_RESET_VERIFY_ENDPOINT = `${API_BASE_URL}/auth/password/reset/verify`;
export const SET_PASSWORD_ENDPOINT = `${API_BASE_URL}/me/password`;
export const CHANGE_PASSWORD_ENDPOINT = `${API_BASE_URL}/me/password`;

function wardrobeImageEndpoint(path: 'original' | 'processed', itemId: string): string {
  const url = new URL(`${API_BASE_URL}/me/wardrobe/images/${path}`);
  url.searchParams.set('itemId', itemId);

  return url.toString();
}

export function wardrobeOriginalImageUploadEndpoint(itemId: string): string {
  return wardrobeImageEndpoint('original', itemId);
}

export function wardrobeProcessedImageUploadEndpoint(itemId: string): string {
  return wardrobeImageEndpoint('processed', itemId);
}

export function wardrobeOriginalImageDownloadEndpoint(itemId: string): string {
  return wardrobeImageEndpoint('original', itemId);
}

export function wardrobeProcessedImageDownloadEndpoint(itemId: string): string {
  return wardrobeImageEndpoint('processed', itemId);
}
