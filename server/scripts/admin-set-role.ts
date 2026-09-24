import { parseAdminSetRoleArgs } from '../src/admin/admin-set-role-cli';
import { setUserAdminRoleByEmail } from '../src/admin/db/admin-identity-repository';
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
    if (parsed.role === null) {
      setUserAdminRoleByEmail(parsed.email, null);
      console.log(`Removed admin access for ${parsed.email}`);
    } else {
      const updated = setUserAdminRoleByEmail(parsed.email, parsed.role);
      console.log(`Updated ${updated!.email} role to ${updated!.role}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

void main();
