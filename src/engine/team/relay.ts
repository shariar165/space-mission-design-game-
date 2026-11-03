// The Online Mission Room's relay (spec: Online room). The room's messages go over one broadcast channel per room
// code, and the relay's presence says who is linked. The site uses Supabase Realtime (src/ui/online/supabaseRelay.ts);
// tests use MemoryHub below, which can delay, drop, reorder and cut messages so the room's catch-up is exercised;
// the Playwright run joins several browser pages through a bridge (src/ui/online/bridgeRelay.ts).
export type PeerKind = 'host' | 'phone';

/** Who is on the channel: the host screen (a random key per session) or a phone (its random token). */
export interface Peer {
  key: string;
  kind: PeerKind;
}

export type RelayStatus = 'connecting' | 'open' | 'offline';

export interface Relay<M> {
  /** Broadcast to everyone else on the channel (never back to the sender). */
  send(msg: M): void;
  onMessage(fn: (msg: M) => void): () => void;
  /** Everyone on the channel now (this end included), each time it changes. */
  onPeers(fn: (peers: Peer[]) => void): () => void;
  onStatus(fn: (s: RelayStatus) => void): () => void;
  close(): void;
}

/** Opens a room's channel. */
export type OpenRelay<M> = (channel: string, me: Peer) => Relay<M>;

/** A tiny listener set. */
export class Listeners<T> {
  private fns = new Set<(x: T) => void>();
  add(fn: (x: T) => void): () => void {
    this.fns.add(fn);
    return () => this.fns.delete(fn);
  }
  emit(x: T): void {
    for (const fn of [...this.fns]) fn(x);
  }
}

interface Queued<M> {
  to: MemoryRelay<M>;
  msg: M;
}

/**
 * An in-memory relay for tests. Messages wait in a queue until `flush` (or, with `auto`, until the next timer tick),
 * so a test decides when they arrive. Switches: `drop` loses chosen messages, `jitter` delivers each flush in a
 * shuffled order, `cut` takes one end off the network (it leaves presence and its sends are lost) and `heal` brings
 * it back; `hide` leaves a connected end out of presence (`show` ends it); `offline` makes new ends fail to connect.
 */
export class MemoryHub<M> {
  private channels = new Map<string, Set<MemoryRelay<M>>>();
  private queue: Queued<M>[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** Lose a message on its way to `to` (return true to drop). */
  drop?: (msg: M, to: Peer) => boolean;
  /** A random source: each flush delivers in a shuffled order. */
  jitter?: () => number;
  offline = false;
  /** Messages delivered so far (a test can count them). */
  delivered = 0;

  constructor(readonly auto = false) {}

  open: OpenRelay<M> = (channel, me) => {
    const r = new MemoryRelay<M>(this, channel, me);
    this.later(() => {
      if (r.closed) return;
      if (this.offline) return r.setStatus('offline');
      this.members(channel).add(r);
      r.isOpen = true;
      r.setStatus('open');
      this.announce(channel);
    });
    return r;
  };

  /** Keys presence leaves out although the end is still connected (a glitch the real relay shows while it settles). */
  private hidden = new Set<string>();

  /** Everyone linked on a channel. */
  peers(channel: string): Peer[] {
    return [...this.members(channel)].filter((r) => !r.isCut && !this.hidden.has(r.me.key)).map((r) => r.me);
  }

  /** Leave an end out of presence while its messages still flow (`show` puts it back). */
  hide(key: string): void {
    this.hidden.add(key);
    for (const channel of this.channels.keys()) this.announce(channel);
  }

  show(key: string): void {
    this.hidden.delete(key);
    for (const channel of this.channels.keys()) this.announce(channel);
  }

  /** Take an end off the network (a phone in a tunnel): it leaves presence and its messages are lost. */
  cut(key: string): void {
    for (const [channel, set] of this.channels)
      for (const r of set)
        if (r.me.key === key && !r.isCut) {
          r.isCut = true;
          r.setStatus('connecting');
          this.announce(channel);
        }
  }

  heal(key: string): void {
    for (const [channel, set] of this.channels)
      for (const r of set)
        if (r.me.key === key && r.isCut) {
          r.isCut = false;
          r.setStatus('open');
          this.announce(channel);
        }
  }

  /** Deliver everything queued (and whatever that sends, up to `max` messages). Returns how many arrived. */
  flush(max = 100_000): number {
    let n = 0;
    while (this.queue.length && n < max) {
      const batch = this.queue.splice(0);
      if (this.jitter) {
        for (let i = batch.length - 1; i > 0; i--) {
          const j = Math.floor(this.jitter() * (i + 1));
          [batch[i], batch[j]] = [batch[j]!, batch[i]!];
        }
      }
      for (const q of batch) {
        if (q.to.closed || q.to.isCut) continue;
        if (this.drop?.(q.msg, q.to.me)) continue;
        n++;
        this.delivered++;
        q.to.messages.emit(q.msg);
      }
    }
    return n;
  }

  /** @internal */
  post(from: MemoryRelay<M>, msg: M): void {
    if (from.isCut || !from.isOpen) return;
    // a message goes through the network as data: each end gets its own copy
    const copy = JSON.parse(JSON.stringify(msg)) as M;
    for (const r of this.members(from.channel)) if (r !== from && !r.isCut) this.queue.push({ to: r, msg: copy });
    this.schedule();
  }

  /** @internal */
  leave(r: MemoryRelay<M>): void {
    this.members(r.channel).delete(r);
    this.announce(r.channel);
  }

  private members(channel: string): Set<MemoryRelay<M>> {
    let set = this.channels.get(channel);
    if (!set) this.channels.set(channel, (set = new Set()));
    return set;
  }

  private announce(channel: string): void {
    const peers = this.peers(channel);
    for (const r of this.members(channel)) if (!r.isCut) r.peers.emit(peers);
  }

  private later(fn: () => void): void {
    if (this.auto) setTimeout(fn, 0);
    else fn();
  }

  private schedule(): void {
    if (!this.auto || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.flush();
    }, 0);
  }
}

export class MemoryRelay<M> implements Relay<M> {
  readonly messages = new Listeners<M>();
  readonly peers = new Listeners<Peer[]>();
  readonly status = new Listeners<RelayStatus>();
  isOpen = false;
  isCut = false;
  closed = false;

  constructor(
    private hub: MemoryHub<M>,
    readonly channel: string,
    readonly me: Peer,
  ) {}

  send(msg: M): void {
    this.hub.post(this, msg);
  }
  onMessage(fn: (msg: M) => void) {
    return this.messages.add(fn);
  }
  onPeers(fn: (peers: Peer[]) => void) {
    const off = this.peers.add(fn);
    if (this.isOpen && !this.isCut) fn(this.hub.peers(this.channel));
    return off;
  }
  /** The status now (a listener hears it at once when it subscribes). */
  current: RelayStatus = 'connecting';
  setStatus(s: RelayStatus): void {
    this.current = s;
    this.status.emit(s);
  }
  onStatus(fn: (s: RelayStatus) => void) {
    const off = this.status.add(fn);
    fn(this.current);
    return off;
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.hub.leave(this);
  }
}
