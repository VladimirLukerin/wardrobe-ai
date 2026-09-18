import {
  familyMemberOriginalImageEndpoint,
  familyMemberProcessedImageEndpoint,
} from '@/config/api';
import type { FamilyWardrobeItem } from '@/services/family-api';

export function getFamilyWardrobeItemImageEndpoint(
  memberPublicId: string,
  item: FamilyWardrobeItem,
): string | null {
  if (item.images.processedAvailable) {
    return familyMemberProcessedImageEndpoint(memberPublicId, item.id);
  }

  if (item.images.originalAvailable) {
    return familyMemberOriginalImageEndpoint(memberPublicId, item.id);
  }

  return null;
}
