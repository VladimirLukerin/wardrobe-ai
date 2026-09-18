let queueHandler: (() => void) | null = null;

export function registerWearHistorySyncQueue(handler: () => void): void {
  queueHandler = handler;
}

export function unregisterWearHistorySyncQueue(): void {
  queueHandler = null;
}

export function queueWearHistorySyncFromMutation(): void {
  queueHandler?.();
}
