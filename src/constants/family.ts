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

export function getFamilyMemberInitial(member: FamilyMember): string {
  const label = getFamilyMemberLabel(member).trim();

  return label.length > 0 ? label.charAt(0).toUpperCase() : '?';
}
