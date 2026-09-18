import type { WearEvent } from '@/constants/wear-event';
import type {
  WearHistorySnapshot,
  WearHistorySyncDeletePayload,
  WearHistorySyncEventPayload,
} from '@/services/wear-history-api';
import type { WearHistorySyncMetadata } from '@/storage/wear-history-sync-storage';

export type WearHistorySyncPlan = {
  eventsToPush: WearHistorySyncEventPayload[];
  deletedEventsToPush: WearHistorySyncDeletePayload[];
  eventsToApply: WearEvent[];
  localEventsToRemove: string[];
  pullCount: number;
};

function getEventUpdatedAt(event: WearEvent, metadata: WearHistorySyncMetadata): string {
  return metadata.eventUpdatedAtById[event.id] ?? event.wornAt;
}

function toSyncPayload(event: WearEvent, clientUpdatedAt: string): WearHistorySyncEventPayload {
  return {
    id: event.id,
    outfitId: event.outfitId,
    itemIds: event.itemIds,
    wornAt: event.wornAt,
    clientUpdatedAt,
  };
}

function toWearEvent(event: WearHistorySnapshot['events'][number]): WearEvent {
  return {
    id: event.id,
    outfitId: event.outfitId,
    itemIds: event.itemIds,
    wornAt: event.wornAt,
  };
}

function compareTimestamps(left: string | null | undefined, right: string | null | undefined): number {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;

  return leftTime - rightTime;
}

export function buildWearHistorySyncPlan({
  localEvents,
  metadata,
  serverSnapshot,
}: {
  localEvents: WearEvent[];
  metadata: WearHistorySyncMetadata;
  serverSnapshot: WearHistorySnapshot;
}): WearHistorySyncPlan {
  const localEventsById = new Map(localEvents.map((event) => [event.id, event]));
  const serverEventsById = new Map(serverSnapshot.events.map((event) => [event.id, event]));
  const serverDeletedById = new Map(
    serverSnapshot.deletedEvents.map((event) => [event.id, event]),
  );

  const eventsToPush: WearHistorySyncEventPayload[] = [];
  const eventsToApply: WearEvent[] = [];
  const localEventsToRemove: string[] = [];
  let pullCount = 0;

  const serverIsEmpty =
    serverSnapshot.events.length === 0 && serverSnapshot.deletedEvents.length === 0;

  if (serverIsEmpty) {
    for (const event of localEvents) {
      eventsToPush.push(toSyncPayload(event, getEventUpdatedAt(event, metadata)));
    }
  } else {
    for (const event of localEvents) {
      const serverEvent = serverEventsById.get(event.id);
      const localUpdatedAt = metadata.eventUpdatedAtById[event.id] ?? null;

      if (!serverEvent) {
        eventsToPush.push(toSyncPayload(event, getEventUpdatedAt(event, metadata)));
        continue;
      }

      const comparison = compareTimestamps(localUpdatedAt, serverEvent.updatedAt);

      if (comparison > 0) {
        eventsToPush.push(toSyncPayload(event, localUpdatedAt!));
      } else if (comparison < 0) {
        eventsToApply.push(toWearEvent(serverEvent));
        pullCount += 1;
      }
    }

    for (const serverEvent of serverSnapshot.events) {
      if (!localEventsById.has(serverEvent.id)) {
        eventsToApply.push(toWearEvent(serverEvent));
        pullCount += 1;
      }
    }

    for (const [eventId, serverDeleted] of serverDeletedById.entries()) {
      const localEvent = localEventsById.get(eventId);
      const localDeleted = metadata.deletedEvents[eventId];

      if (!localEvent) {
        continue;
      }

      const localUpdatedAt = metadata.eventUpdatedAtById[eventId] ?? null;
      const localDeleteTime = localDeleted?.deletedAt ?? null;
      const serverDeleteComparison = compareTimestamps(localDeleteTime, serverDeleted.deletedAt);
      const localEventComparison = compareTimestamps(localUpdatedAt, serverDeleted.deletedAt);

      if (serverDeleteComparison >= 0 && localEventComparison < 0) {
        localEventsToRemove.push(eventId);
      }
    }
  }

  const deletedEventsToPush = Object.entries(metadata.deletedEvents).map(([id, tombstone]) => ({
    id,
    clientDeletedAt: tombstone.deletedAt,
  }));

  return {
    eventsToPush,
    deletedEventsToPush,
    eventsToApply,
    localEventsToRemove,
    pullCount,
  };
}

export function buildWearHistoryMetadataAfterSync({
  metadata,
  serverSnapshot,
  acknowledgedDeleteIds,
}: {
  metadata: WearHistorySyncMetadata;
  serverSnapshot: WearHistorySnapshot;
  acknowledgedDeleteIds: string[];
}): WearHistorySyncMetadata {
  const nextDeletedEvents = { ...metadata.deletedEvents };
  const nextEventUpdatedAtById = { ...metadata.eventUpdatedAtById };
  const nextServerUpdatedAtById = { ...metadata.serverUpdatedAtById };

  for (const deleteId of acknowledgedDeleteIds) {
    delete nextDeletedEvents[deleteId];
  }

  for (const event of serverSnapshot.events) {
    nextServerUpdatedAtById[event.id] = event.updatedAt;
    nextEventUpdatedAtById[event.id] = event.updatedAt;
  }

  for (const deletedEvent of serverSnapshot.deletedEvents) {
    delete nextEventUpdatedAtById[deletedEvent.id];
    delete nextServerUpdatedAtById[deletedEvent.id];
  }

  return {
    eventUpdatedAtById: nextEventUpdatedAtById,
    serverUpdatedAtById: nextServerUpdatedAtById,
    deletedEvents: nextDeletedEvents,
    lastServerSyncAt: serverSnapshot.serverTime,
  };
}
