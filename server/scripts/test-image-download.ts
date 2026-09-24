import { createSessionForUser } from '../src/db/sessions-repository';
import { getDatabase } from '../src/db/database';

async function test(label: string, url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (res.ok) {
    const buf = Buffer.from(await res.arrayBuffer());
    console.log(
      `${label} status=${res.status} ctype=${res.headers.get('content-type')} bytes=${buf.length}`,
    );
    return;
  }

  const body = await res.text();
  console.log(`${label} status=${res.status} body=${body.slice(0, 120)}`);
}

async function main() {
  getDatabase();
  const userId = '3e628672-c124-43c4-91f0-12f5e424515d';
  const { token } = createSessionForUser(userId);
  const row = getDatabase()
    .prepare('SELECT item_id FROM wardrobe_items WHERE user_id = ? AND deleted_at IS NULL LIMIT 1')
    .get(userId) as { item_id: string };
  const itemId = row.item_id;
  const encoded = encodeURIComponent(itemId);
  const base = 'http://127.0.0.1:3000';

  console.log('itemId_len', itemId.length);
  console.log('encoded_has_percent2F', encoded.includes('%2F'));

  await test('query-processed', `${base}/me/wardrobe/images/processed?itemId=${encoded}`, token);
  await test('query-original', `${base}/me/wardrobe/images/original?itemId=${encoded}`, token);
  await test('path-processed', `${base}/me/wardrobe/${encoded}/images/processed`, token);
}

void main();
