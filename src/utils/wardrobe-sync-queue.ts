let queueHandler: (() => void) | null = null;

export function registerWardrobeSyncQueue(handler: () => void): void {
  queueHandler = handler;
}

export function unregisterWardrobeSyncQueue(): void {
  queueHandler = null;
}

export function queueWardrobeSyncFromMutation(): void {
  queueHandler?.();
}
