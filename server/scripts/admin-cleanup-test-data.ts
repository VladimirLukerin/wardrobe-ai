import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import {
  ADMIN_TEST_EMAIL_MATCHERS,
  countAdminTestDataRows,
  deleteAdminTestDataRows,
} from '../src/admin/db/admin-test-data-cleanup';
import { closeDatabase, getDatabase, resolveDatabasePath } from '../src/db/database';

async function confirmDeletion(count: number, assumeYes: boolean): Promise<boolean> {
  if (assumeYes) {
    return true;
  }

  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(
    `Delete ${count} test admin row(s) and related sessions/audit entries? Type yes to continue: `,
  );
  rl.close();

  return answer.trim().toLowerCase() === 'yes';
}

async function main(): Promise<void> {
  getDatabase();

  const count = countAdminTestDataRows();
  console.log(`Found ${count} test-generated admin account(s) in ${resolveDatabasePath()}.`);

  if (count === 0) {
    closeDatabase();
    return;
  }

  const assumeYes = process.argv.includes('--yes');

  if (!(await confirmDeletion(count, assumeYes))) {
    console.log('Cleanup cancelled.');
    closeDatabase();
    return;
  }

  const deleted = deleteAdminTestDataRows();
  console.log(`Deleted ${deleted.adminUsers} test admin user(s).`);
  closeDatabase();
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
  closeDatabase();
});
