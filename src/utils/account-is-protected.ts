import type { ServerUser } from '@/services/account';

export function isAccountProtected(user: ServerUser | null | undefined): boolean {
  return Boolean(user?.emailVerified || user?.phoneVerified);
}
