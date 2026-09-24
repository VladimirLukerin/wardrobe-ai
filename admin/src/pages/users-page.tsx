import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchUsers } from '../api/admin-api';
import { ErrorBanner, EmptyState, LoadingState } from '../components/state-panels';
import type { AdminUserListItem } from '../types/admin-api';
import { accountTypeLabel, formatDateTime } from '../utils/format';

type AccountFilter = 'all' | 'guest' | 'protected';

export function UsersPage() {
  const [items, setItems] = useState<AdminUserListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [queryInput, setQueryInput] = useState('');
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchUsers({
      q,
      accountType: accountFilter === 'all' ? undefined : accountFilter,
      limit: 25,
    })
      .then((response) => {
        if (!cancelled) {
          setItems(response.items);
          setNextCursor(response.nextCursor);
          setCursor(null);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(fetchError);
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [q, accountFilter]);

  async function loadMore() {
    if (!nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      const response = await fetchUsers({
        q,
        accountType: accountFilter === 'all' ? undefined : accountFilter,
        limit: 25,
        cursor: nextCursor,
      });

      setItems((current) => [...current, ...response.items]);
      setCursor(nextCursor);
      setNextCursor(response.nextCursor);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="stack-lg">
      <div>
        <h1 className="page-title">Users</h1>
        <p className="page-subtitle">Read-only account directory</p>
      </div>

      <div className="toolbar">
        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault();
            setQ(queryInput.trim());
          }}>
          <input
            type="search"
            placeholder="publicId or verified email"
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
          />
          <button type="submit" className="button-secondary">
            Search
          </button>
        </form>

        <select
          value={accountFilter}
          onChange={(event) => setAccountFilter(event.target.value as AccountFilter)}>
          <option value="all">All accounts</option>
          <option value="guest">Guest</option>
          <option value="protected">Protected</option>
        </select>
      </div>

      <ErrorBanner error={error} />

      {loading ? <LoadingState label="Загрузка пользователей…" /> : null}

      {!loading && items.length === 0 ? <EmptyState label="Пользователи не найдены." /> : null}

      {!loading && items.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>publicId</th>
                  <th>Type</th>
                  <th>Email ✓</th>
                  <th>Phone ✓</th>
                  <th>Wardrobe</th>
                  <th>Outfits</th>
                  <th>Family</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {items.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <Link className="row-link" to={`/users/${user.id}`}>
                        {user.publicId}
                      </Link>
                    </td>
                    <td>{accountTypeLabel(user.accountType)}</td>
                    <td>{user.emailVerified ? 'yes' : 'no'}</td>
                    <td>{user.phoneVerified ? 'yes' : 'no'}</td>
                    <td>{user.wardrobeCount}</td>
                    <td>{user.savedOutfitCount}</td>
                    <td>{user.familyMemberCount}</td>
                    <td>{formatDateTime(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cards-list">
            {items.map((user) => (
              <Link key={user.id} className="user-card" to={`/users/${user.id}`}>
                <div className="user-card-title">{user.publicId}</div>
                <div className="user-card-meta">
                  {accountTypeLabel(user.accountType)} · wardrobe {user.wardrobeCount}
                </div>
              </Link>
            ))}
          </div>

          {nextCursor ? (
            <button type="button" className="button-secondary" disabled={loadingMore} onClick={() => void loadMore()}>
              {loadingMore ? 'Загрузка…' : 'Load more'}
            </button>
          ) : cursor ? (
            <div className="hint-text">End of list</div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
