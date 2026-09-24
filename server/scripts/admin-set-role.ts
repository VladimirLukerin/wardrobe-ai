import { parseAdminSetRoleArgs } from '../src/admin/admin-set-role-cli';
import { setAdminUserRoleByEmail } from '../src/admin/db/admin-users-repository';
import { closeDatabase, getDatabase } from '../src/db/database';

async function main(): Promise<void> {
  getDatabase();

  let parsed;

  try {
    parsed = parseAdminSetRoleArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
    return;
  }

  try {
    const updated = setAdminUserRoleByEmail(parsed.email, parsed.role);
    console.log(`Updated ${updated.email} role to ${updated.role}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

void main();
