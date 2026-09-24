import { closeDatabase, getDatabase } from '../src/db/database';

async function main(): Promise<void> {
  getDatabase();

  console.error(
    'admin:create is deprecated. Register a normal app user (email + password), then run:\n' +
      '  npm run admin:set-role -- --email you@example.com --role owner',
  );
  closeDatabase();
  process.exit(1);
}

void main();
