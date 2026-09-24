export type AccountProfile = {
  /** Legacy local placeholder ID; replaced by server publicId after sync. */
  localUserId: string;
  displayName: string;
  publicId?: string;
  serverUserId?: string;
};

/** Empty until the user or server sets a real display name. */
export const DEFAULT_DISPLAY_NAME = '';

export const DISPLAY_NAME_MAX_LENGTH = 50;

export const DEFAULT_ACCOUNT_PROFILE: AccountProfile = {
  localUserId: '',
  displayName: DEFAULT_DISPLAY_NAME,
};
