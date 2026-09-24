export function canMutateAdminSettings(role: string | undefined): boolean {
  return role === 'admin' || role === 'owner';
}
