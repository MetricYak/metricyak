const WRITE_INTERVAL_MS = 60_000;

export class LastUsedTracker {
  private readonly writtenAt = new Map<string, number>();

  constructor(private readonly intervalMs: number = WRITE_INTERVAL_MS) {}

  shouldWrite(keyId: string, now: Date): boolean {
    const previous = this.writtenAt.get(keyId);
    if (previous !== undefined && now.getTime() - previous < this.intervalMs) return false;
    this.writtenAt.set(keyId, now.getTime());
    return true;
  }
}
