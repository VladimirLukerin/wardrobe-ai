const DEFAULT_SESSION_TTL_HOURS = 24;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function getAdminSessionTtlMs(): number {
  const hours = parsePositiveInt(process.env.ADMIN_SESSION_TTL_HOURS, DEFAULT_SESSION_TTL_HOURS);
  return hours * 60 * 60 * 1000;
}

export const ADMIN_ROLES = ['owner', 'admin', 'viewer'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}

const ROLE_RANK: Record<AdminRole, number> = {
  viewer: 1,
  admin: 2,
  owner: 3,
};

export function adminRoleMeetsRequirement(role: AdminRole, minimumRole: AdminRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimumRole];
}
