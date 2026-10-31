// Team mode: how log entries travel (spec: Team mode). Every team action goes through a Transport; the order it
// hands them out in is the log's order. LocalTransport is one device passed around the table; an online transport
// (later) implements the same interface and nothing else changes.
import type { TeamAction } from './log';

export interface Transport {
  /** Send an entry; the transport gives it its place in the log (seq). */
  send(a: Omit<TeamAction, 'seq'>): void;
  /** Hear every entry, in log order. Returns the unsubscribe. */
  subscribe(listener: (a: TeamAction) => void): () => void;
  /** The log so far (read-only). */
  log(): readonly TeamAction[];
}

export class LocalTransport implements Transport {
  private entries: TeamAction[] = [];
  private listeners = new Set<(a: TeamAction) => void>();

  constructor(log: readonly TeamAction[] = []) {
    this.entries = [...log];
  }

  send(a: Omit<TeamAction, 'seq'>): void {
    const entry: TeamAction = { ...a, seq: this.entries.length + 1 };
    this.entries.push(entry);
    for (const l of [...this.listeners]) l(entry);
  }

  subscribe(listener: (a: TeamAction) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  log(): readonly TeamAction[] {
    return Object.freeze([...this.entries]);
  }
}
