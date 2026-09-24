import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  fetchUserDetail,
  fetchUserFamily,
  fetchUserOutfits,
  fetchUserWardrobe,
  fetchUserWearHistory,
} from '../api/admin-api';
import { ErrorBanner, EmptyState, LoadingState } from '../components/state-panels';
import type {
  AdminFamilyMemberItem,
  AdminOutfitItem,
  AdminUserDetailResponse,
  AdminWardrobeItem,
  AdminWearEventItem,
} from '../types/admin-api';
import { accountTypeLabel, formatDateTime } from '../utils/format';

type TabId = 'overview' | 'wardrobe' | 'outfits' | 'wear' | 'family';

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={active ? 'tab active' : 'tab'} onClick={onClick}>
      {label}
    </button>
  );
}

export function UserDetailPage() {
  const { id = '' } = useParams();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [detail, setDetail] = useState<AdminUserDetailResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const [wardrobe, setWardrobe] = useState<AdminWardrobeItem[]>([]);
  const [wardrobeCursor, setWardrobeCursor] = useState<string | null>(null);
  const [outfits, setOutfits] = useState<AdminOutfitItem[]>([]);
  const [outfitsCursor, setOutfitsCursor] = useState<string | null>(null);
  const [wear, setWear] = useState<AdminWearEventItem[]>([]);
  const [wearCursor, setWearCursor] = useState<string | null>(null);
  const [family, setFamily] = useState<AdminFamilyMemberItem[]>([]);
  const [familyCursor, setFamilyCursor] = useState<string | null>(null);
  const [tabLoading, setTabLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setActiveTab('overview');

    void fetchUserDetail(id)
      .then((response) => {
        if (!cancelled) {
          setDetail(response);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(fetchError);
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
  }, [id]);

  useEffect(() => {
    if (!detail) {
      return;
    }

    let cancelled = false;
    setTabLoading(true);
    setError(null);

    const userKey = detail.account.id;

    async function loadTab() {
      try {
        if (activeTab === 'wardrobe') {
          const response = await fetchUserWardrobe(userKey);
          if (!cancelled) {
            setWardrobe(response.items);
            setWardrobeCursor(response.nextCursor);
          }
        }

        if (activeTab === 'outfits') {
          const response = await fetchUserOutfits(userKey);
          if (!cancelled) {
            setOutfits(response.items);
            setOutfitsCursor(response.nextCursor);
          }
        }

        if (activeTab === 'wear') {
          const response = await fetchUserWearHistory(userKey);
          if (!cancelled) {
            setWear(response.items);
            setWearCursor(response.nextCursor);
          }
        }

        if (activeTab === 'family') {
          const response = await fetchUserFamily(userKey);
          if (!cancelled) {
            setFamily(response.items);
            setFamilyCursor(response.nextCursor);
          }
        }
      } catch (tabError) {
        if (!cancelled) {
          setError(tabError);
        }
      } finally {
        if (!cancelled) {
          setTabLoading(false);
        }
      }
    }

    if (activeTab !== 'overview') {
      void loadTab();
    } else {
      setTabLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [activeTab, detail]);

  if (loading) {
    return <LoadingState label="Загрузка пользователя…" />;
  }

  if (!detail) {
    return (
      <div className="stack-lg">
        <Link to="/users" className="back-link">
          ← Users
        </Link>
        <ErrorBanner error={error} />
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <Link to="/users" className="back-link">
        ← Users
      </Link>

      <div>
        <h1 className="page-title">{detail.account.publicId}</h1>
        <p className="page-subtitle">{accountTypeLabel(detail.account.accountType)} account</p>
      </div>

      <div className="tab-row">
        <TabButton active={activeTab === 'overview'} label="Overview" onClick={() => setActiveTab('overview')} />
        <TabButton active={activeTab === 'wardrobe'} label="Wardrobe" onClick={() => setActiveTab('wardrobe')} />
        <TabButton active={activeTab === 'outfits'} label="Outfits" onClick={() => setActiveTab('outfits')} />
        <TabButton active={activeTab === 'wear'} label="Wear history" onClick={() => setActiveTab('wear')} />
        <TabButton active={activeTab === 'family'} label="Family" onClick={() => setActiveTab('family')} />
      </div>

      <ErrorBanner error={error} />

      {activeTab === 'overview' ? (
        <div className="detail-grid">
          <section className="panel">
            <h2>Account</h2>
            <dl className="detail-list">
              <dt>publicId</dt>
              <dd>{detail.account.publicId}</dd>
              <dt>Display name</dt>
              <dd>{detail.account.displayName ?? '—'}</dd>
              <dt>Email verified</dt>
              <dd>{detail.account.emailVerified ? 'yes' : 'no'}</dd>
              <dt>Phone verified</dt>
              <dd>{detail.account.phoneVerified ? 'yes' : 'no'}</dd>
              <dt>Created</dt>
              <dd>{formatDateTime(detail.account.createdAt)}</dd>
              <dt>Updated</dt>
              <dd>{formatDateTime(detail.account.updatedAt)}</dd>
            </dl>
          </section>

          <section className="panel">
            <h2>Counts</h2>
            <dl className="detail-list">
              <dt>Wardrobe</dt>
              <dd>{detail.counts.wardrobeCount}</dd>
              <dt>Outfits</dt>
              <dd>{detail.counts.savedOutfitCount}</dd>
              <dt>Wear events</dt>
              <dd>{detail.counts.wearEventCount}</dd>
              <dt>Family</dt>
              <dd>{detail.counts.familyMemberCount}</dd>
            </dl>
          </section>

          <section className="panel">
            <h2>Settings</h2>
            <dl className="detail-list">
              <dt>Daily stylist</dt>
              <dd>
                {detail.settings.dailyStylistEnabled === null
                  ? '—'
                  : detail.settings.dailyStylistEnabled
                    ? 'enabled'
                    : 'disabled'}
              </dd>
              <dt>Time</dt>
              <dd>{detail.settings.dailyStylistTime ?? '—'}</dd>
              <dt>Timezone</dt>
              <dd>{detail.settings.timezone ?? '—'}</dd>
              <dt>Location mode</dt>
              <dd>{detail.settings.bodyLocationMode ?? '—'}</dd>
              <dt>Preferences updated</dt>
              <dd>{formatDateTime(detail.settings.preferencesUpdatedAt)}</dd>
            </dl>
          </section>
        </div>
      ) : null}

      {tabLoading ? <LoadingState /> : null}

      {activeTab === 'wardrobe' && !tabLoading ? (
        wardrobe.length === 0 ? (
          <EmptyState label="No wardrobe items." />
        ) : (
          <div className="item-grid">
            {wardrobe.map((item) => (
              <div key={item.id} className="item-card">
                <div className="thumb-placeholder">
                  {item.hasProcessedImage || item.hasOriginalImage ? 'image on file' : 'no image'}
                </div>
                <div className="item-card-title">{item.category}</div>
                <div className="item-card-meta">
                  {item.color} · {item.isFavorite ? 'favorite' : 'regular'}
                </div>
                <div className="item-card-meta">{formatDateTime(item.updatedAt)}</div>
              </div>
            ))}
          </div>
        )
      ) : null}

      {activeTab === 'outfits' && !tabLoading ? (
        outfits.length === 0 ? (
          <EmptyState label="No saved outfits." />
        ) : (
          <div className="stack-md">
            {outfits.map((outfit) => (
              <div key={outfit.id} className="panel compact">
                <div className="panel-title">{outfit.title}</div>
                <div className="panel-meta">
                  {outfit.itemCount} items · {outfit.source ?? 'unknown source'} ·{' '}
                  {formatDateTime(outfit.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}

      {activeTab === 'wear' && !tabLoading ? (
        wear.length === 0 ? (
          <EmptyState label="No wear history." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Worn at</th>
                  <th>Outfit ID</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {wear.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDateTime(event.wornAt)}</td>
                    <td>{event.outfitId}</td>
                    <td>{formatDateTime(event.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {activeTab === 'family' && !tabLoading ? (
        family.length === 0 ? (
          <EmptyState label="No family members." />
        ) : (
          <div className="stack-md">
            {family.map((member) => (
              <div key={member.memberUserId} className="panel compact">
                <div className="panel-title">{member.memberPublicId}</div>
                <div className="panel-meta">Linked {formatDateTime(member.linkedAt)}</div>
              </div>
            ))}
          </div>
        )
      ) : null}

      {(wardrobeCursor || outfitsCursor || wearCursor || familyCursor) && !tabLoading ? (
        <div className="hint-text">More items available via pagination (load-more in a later iteration).</div>
      ) : null}
    </div>
  );
}
