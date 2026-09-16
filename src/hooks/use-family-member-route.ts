import { useLocalSearchParams } from 'expo-router';

import { getFamilyMemberLabel, type FamilyMember } from '@/constants/family';
import { useFamily } from '@/contexts/family-context';

export type FamilyMemberRouteParams = {
  publicId: string;
  displayName?: string;
};

/**
 * Resolves the family member for `/profile/family/[publicId]` screens.
 * The member itself is looked up in FamilyContext (server-backed); the optional
 * `displayName` param is only a fallback label while the family list is loading.
 */
export function useFamilyMemberRoute() {
  const params = useLocalSearchParams<FamilyMemberRouteParams>();
  const { members, status } = useFamily();

  const publicId = typeof params.publicId === 'string' ? params.publicId : '';
  const fallbackName =
    typeof params.displayName === 'string' && params.displayName.trim().length > 0
      ? params.displayName.trim()
      : null;

  const member: FamilyMember | null =
    members.find((candidate) => candidate.publicId === publicId) ?? null;

  const label = member ? getFamilyMemberLabel(member) : fallbackName ?? publicId;
  const isResolving = !member && (status === 'idle' || status === 'loading');

  return { publicId, member, label, isResolving, familyStatus: status };
}
