import type { BodyParameters } from '@/constants/body-parameters';
import type { StylistPreferences } from '@/constants/stylist-preferences';
import {
  getPreferences,
  putPreferences,
  type ServerPreferences,
} from '@/services/account-preferences';
import type { PreferencesSyncMetadata } from '@/storage/preferences-sync-storage';

export type LocalPreferencesSnapshot = {
  displayName: string;
  bodyParameters: BodyParameters;
  stylistPreferences: StylistPreferences;
};

export type PreferencesSyncAction = 'push' | 'pull' | 'noop' | 'offline';

function compareTimestamps(localUpdatedAt: string | null, serverUpdatedAt: string | null): number {
  if (!localUpdatedAt && !serverUpdatedAt) {
    return 0;
  }

  if (!localUpdatedAt) {
    return -1;
  }

  if (!serverUpdatedAt) {
    return 1;
  }

  return new Date(localUpdatedAt).getTime() - new Date(serverUpdatedAt).getTime();
}

export function resolvePreferencesSyncAction({
  metadata,
  serverPreferences,
}: {
  metadata: PreferencesSyncMetadata;
  serverPreferences: ServerPreferences;
}): Exclude<PreferencesSyncAction, 'offline'> {
  if (!serverPreferences.updatedAt) {
    return 'push';
  }

  const comparison = compareTimestamps(metadata.localUpdatedAt, serverPreferences.updatedAt);

  if (comparison > 0) {
    return 'push';
  }

  if (comparison < 0) {
    return 'pull';
  }

  return 'noop';
}

export async function fetchServerPreferences(token: string): Promise<ServerPreferences> {
  return getPreferences(token);
}

export async function pushLocalPreferences({
  token,
  snapshot,
  clientUpdatedAt,
}: {
  token: string;
  snapshot: LocalPreferencesSnapshot;
  clientUpdatedAt?: string | null;
}): Promise<ServerPreferences> {
  return putPreferences(token, {
    displayName: snapshot.displayName,
    bodyParameters: snapshot.bodyParameters,
    stylistPreferences: snapshot.stylistPreferences,
    clientUpdatedAt,
  });
}
