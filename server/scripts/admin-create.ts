import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { normalizeEmail } from '../src/auth/normalize-email';
import { validatePasswordInput } from '../src/auth/password';
import { isAdminRole, type AdminRole } from '../src/admin/admin-config';
import { createAdminUser } from '../src/admin/db/admin-users-repository';
import { closeDatabase, getDatabase } from '../src/db/database';

async function readRequiredEnvOrPrompt(
  envValue: string | undefined,
  promptLabel: string,
  hidden = false,
): Promise<string> {
  if (envValue?.trim()) {
    return envValue.trim();
  }

  const rl = readline.createInterface({ input, output });
  const answer = hidden
    ? await rl.question(`${promptLabel}: `)
    : await rl.question(`${promptLabel}: `);
  rl.close();

  const trimmed = answer.trim();

  if (!trimmed) {
    throw new Error(`${promptLabel} is required.`);
  }

  return trimmed;
}

async function main(): Promise<void> {
  getDatabase();

  const email = await readRequiredEnvOrPrompt(process.env.ADMIN_EMAIL, 'Admin email');
  const password = await readRequiredEnvOrPrompt(process.env.ADMIN_PASSWORD, 'Admin password', true);
  const roleRaw = (process.env.ADMIN_ROLE ?? 'owner').trim();
  const role: AdminRole = isAdminRole(roleRaw) ? roleRaw : 'owner';

  const normalized = normalizeEmail(email);

  if (!normalized.ok) {
    console.error('Invalid admin email.');
    process.exit(1);
  }

  const passwordValidated = validatePasswordInput(password);

  if (!passwordValidated.ok) {
    console.error(passwordValidated.message);
    process.exit(1);
  }

  try {
    const admin = await createAdminUser({
      email: normalized.email,
      password: passwordValidated.password,
      role,
    });

    console.log(`Created admin user ${admin.email} with role ${admin.role}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

void main();
