export type AccountProfile = {
  localUserId: string;
  displayName: string;
};

export const DEFAULT_DISPLAY_NAME = 'Владимир';

export const DEFAULT_ACCOUNT_PROFILE: AccountProfile = {
  localUserId: '',
  displayName: DEFAULT_DISPLAY_NAME,
};
