export const FAMILY_ROLES = ['Партнёр', 'Ребёнок', 'Родитель', 'Другой'] as const;

export type FamilyRole = (typeof FAMILY_ROLES)[number];

export type FamilyMember = {
  id: string;
  name: string;
  role: FamilyRole;
};
