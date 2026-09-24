import { isAdminRole, type AdminRole } from './admin-config';

export type ParsedAdminSetRoleArgs = {
  email: string;
  role: AdminRole;
};

export function parseAdminSetRoleArgs(argv: string[]): ParsedAdminSetRoleArgs {
  let email: string | undefined;
  let roleRaw: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--email') {
      email = argv[index + 1]?.trim();
      index += 1;
      continue;
    }

    if (arg === '--role') {
      roleRaw = argv[index + 1]?.trim();
      index += 1;
    }
  }

  if (!email) {
    throw new Error('Missing --email.');
  }

  if (!roleRaw) {
    throw new Error('Missing --role.');
  }

  if (!isAdminRole(roleRaw)) {
    throw new Error('Invalid admin role.');
  }

  return { email, role: roleRaw };
}
