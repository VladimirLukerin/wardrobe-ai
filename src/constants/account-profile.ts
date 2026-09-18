export type AccountProfile = {
  /** Legacy local placeholder ID; replaced by server publicId after sync. */
  localUserId: string;
  displayName: string;
  publicId?: string;
  serverUserId?: string;
};

export const DEFAULT_DISPLAY_NAME = 'Владимир';

export const DISPLAY_NAME_MAX_LENGTH = 50;

export const DEFAULT_ACCOUNT_PROFILE: AccountProfile = {
  localUserId: '',
  displayName: DEFAULT_DISPLAY_NAME,
};
