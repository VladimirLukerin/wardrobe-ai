export type FamilyMember = {
  publicId: string;
  displayName: string | null;
};

export type FamilyInvite = {
  id: string;
  sender: FamilyMember;
  createdAt: string;
};

export type OutgoingFamilyInvite = {
  id: string;
  recipient: FamilyMember;
  createdAt: string;
};

export function getFamilyMemberLabel(member: FamilyMember): string {
  const trimmedName = member.displayName?.trim();

  return trimmedName && trimmedName.length > 0 ? trimmedName : member.publicId;
}
