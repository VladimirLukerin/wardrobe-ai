let queueHandler: (() => void) | null = null;

export function registerOutfitsSyncQueue(handler: () => void): void {
  queueHandler = handler;
}

export function unregisterOutfitsSyncQueue(): void {
  queueHandler = null;
}

export function queueOutfitsSyncFromMutation(): void {
  queueHandler?.();
}
