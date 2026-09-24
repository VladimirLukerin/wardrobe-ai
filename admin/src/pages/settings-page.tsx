import { useEffect, useMemo, useState } from 'react';

import { fetchAdminSettings, updateAdminSetting } from '../api/admin-api';
import { useAuth } from '../auth/auth-context';
import { canMutateAdminSettings } from '../auth/admin-settings-permissions';
import { ErrorBanner, LoadingState } from '../components/state-panels';
import type { AdminAppSettingEntry, AppSettingKey } from '../types/admin-api';


export function SettingsPage() {
  const { state } = useAuth();
  const role = state.status === 'authenticated' ? state.admin.role : undefined;
  const canEdit = canMutateAdminSettings(role);

  const [settings, setSettings] = useState<AdminAppSettingEntry[]>([]);
  const [draft, setDraft] = useState<Record<string, boolean | number | string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<AppSettingKey | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [successKey, setSuccessKey] = useState<AppSettingKey | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchAdminSettings()
      .then((response) => {
        if (!cancelled) {
          setSettings(response.settings);
          setDraft(
            Object.fromEntries(response.settings.map((entry) => [entry.key, entry.value])),
          );
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
  }, []);

  const featureSettings = useMemo(
    () => settings.filter((entry) => entry.clientSafe),
    [settings],
  );

  const adminOnlySettings = useMemo(
    () => settings.filter((entry) => !entry.clientSafe),
    [settings],
  );

  const handleSave = async (key: AppSettingKey) => {
    setSavingKey(key);
    setError(null);
    setSuccessKey(null);

    try {
      const result = await updateAdminSetting(key, draft[key]!);
      setSettings((current) =>
        current.map((entry) => (entry.key === key ? result.setting : entry)),
      );
      setSuccessKey(key);
    } catch (saveError) {
      setError(saveError);
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return <LoadingState label="Загрузка настроек…" />;
  }

  return (
    <div className="stack-lg">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Server-driven feature flags (explicit save)</p>
      </div>

      <ErrorBanner error={error} />

      {!canEdit ? (
        <p className="page-subtitle">Your role is read-only. Contact an admin to change settings.</p>
      ) : null}

      <section className="stack-md">
        <h2 className="section-title">AI / Features</h2>
        <div className="settings-list">
          {featureSettings.map((entry) => (
            <SettingRow
              key={entry.key}
              entry={entry}
              value={draft[entry.key] ?? entry.value}
              canEdit={canEdit}
              saving={savingKey === entry.key}
              saved={successKey === entry.key}
              onChange={(value) => {
                setDraft((current) => ({ ...current, [entry.key]: value }));
                setSuccessKey(null);
              }}
              onSave={() => void handleSave(entry.key)}
            />
          ))}
        </div>
      </section>

      {adminOnlySettings.length > 0 ? (
        <section className="stack-md">
          <h2 className="section-title">Admin only</h2>
          <div className="settings-list">
            {adminOnlySettings.map((entry) => (
              <SettingRow
                key={entry.key}
                entry={entry}
                value={draft[entry.key] ?? entry.value}
                canEdit={canEdit}
                saving={savingKey === entry.key}
                saved={successKey === entry.key}
                onChange={(value) => {
                  setDraft((current) => ({ ...current, [entry.key]: value }));
                  setSuccessKey(null);
                }}
                onSave={() => void handleSave(entry.key)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SettingRow({
  entry,
  value,
  canEdit,
  saving,
  saved,
  onChange,
  onSave,
}: {
  entry: AdminAppSettingEntry;
  value: boolean | number | string;
  canEdit: boolean;
  saving: boolean;
  saved: boolean;
  onChange: (value: boolean | number | string) => void;
  onSave: () => void;
}) {
  const dirty = value !== entry.value;
  const forbidden = !canEdit;

  return (
    <div className="setting-row">
      <div className="setting-copy">
        <div className="setting-name">{entry.key}</div>
        <div className="page-subtitle">{entry.description}</div>
      </div>

      <div className="setting-control">
        {entry.valueType === 'boolean' ? (
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={value === true}
              disabled={forbidden}
              onChange={(event) => onChange(event.target.checked)}
            />
            <span>{value === true ? 'Enabled' : 'Disabled'}</span>
          </label>
        ) : null}

        {entry.valueType === 'integer' ? (
          <input
            className="text-input"
            type="number"
            disabled={forbidden}
            value={typeof value === 'number' ? value : 0}
            onChange={(event) => onChange(Number.parseInt(event.target.value, 10) || 0)}
          />
        ) : null}

        {entry.valueType === 'string' ? (
          <input
            className="text-input"
            type="text"
            disabled={forbidden}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : null}

        {canEdit ? (
          <button
            type="button"
            className="button-primary"
            disabled={!dirty || saving}
            onClick={onSave}>
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </button>
        ) : null}

        {errorMessage(entry, value)}
      </div>
    </div>
  );
}

function errorMessage(entry: AdminAppSettingEntry, value: boolean | number | string) {
  if (entry.valueType === 'integer' && typeof value === 'number' && value < 0) {
    return <span className="field-error">Must be zero or greater.</span>;
  }

  if (entry.valueType === 'string' && typeof value === 'string' && value.length > 500) {
    return <span className="field-error">Too long.</span>;
  }

  return null;
}
