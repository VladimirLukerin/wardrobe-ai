import type { ServerUser } from '@/services/account';
import { isAccountProtected } from './account-is-protected';

export function canUseFamilyFeatures(user: ServerUser | null | undefined): boolean {
  return isAccountProtected(user);
}

export function requiresProtectedAccount(user: ServerUser | null | undefined): boolean {
  return canUseFamilyFeatures(user);
}
