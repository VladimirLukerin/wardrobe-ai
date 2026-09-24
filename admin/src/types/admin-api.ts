export type AdminRole = 'owner' | 'admin' | 'viewer';

export type AdminIdentity = {
  id: string;
  email: string;
  role: AdminRole;
  createdAt: string;
  lastLoginAt: string | null;
};

export type AdminLoginResponse = {
  token: string;
  admin: AdminIdentity;
};

export type AdminMeResponse = {
  admin: AdminIdentity;
};

export type AccountType = 'guest' | 'protected';

export type AdminUserListItem = {
  id: string;
  publicId: string;
  accountType: AccountType;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
  wardrobeCount: number;
  savedOutfitCount: number;
  familyMemberCount: number;
};

export type AdminUsersListResponse = {
  items: AdminUserListItem[];
  nextCursor: string | null;
};

export type AdminUserDetailResponse = {
  account: {
    id: string;
    publicId: string;
    accountType: AccountType;
    displayName: string | null;
    emailVerified: boolean;
    phoneVerified: boolean;
    hasVerifiedEmailOnFile: boolean;
    hasVerifiedPhoneOnFile: boolean;
    createdAt: string;
    updatedAt: string;
  };
  counts: {
    wardrobeCount: number;
    savedOutfitCount: number;
    wearEventCount: number;
    familyMemberCount: number;
  };
  settings: {
    dailyStylistEnabled: boolean | null;
    dailyStylistTime: string | null;
    timezone: string | null;
    bodyLocationMode: string | null;
    preferencesUpdatedAt: string | null;
  };
};

export type AdminDashboardMetrics = {
  totalUsers: number;
  guestUsers: number;
  protectedUsers: number;
  totalWardrobeItems: number;
  totalSavedOutfits: number;
  totalFamilyRelationships: number;
};

export type AdminWardrobeItem = {
  id: string;
  category: string;
  color: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  hasOriginalImage: boolean;
  hasProcessedImage: boolean;
};

export type PaginatedResponse<T> = {
  userId: string;
  items: T[];
  nextCursor: string | null;
};

export type AdminOutfitItem = {
  id: string;
  title: string;
  source: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminWearEventItem = {
  id: string;
  outfitId: string;
  wornAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminFamilyMemberItem = {
  memberUserId: string;
  memberPublicId: string;
  linkedAt: string;
};

export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'validation'
  | 'server'
  | 'network'
  | 'unknown';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly retryAfterSeconds: number | null;

  constructor(
    message: string,
    status: number,
    code: ApiErrorCode,
    retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
