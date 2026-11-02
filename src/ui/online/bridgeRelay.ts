// A relay through the Playwright test process (tests/visual/online.spec.ts): each browser page is one phone or the host
// screen, and the test passes their messages between pages, so several browser contexts play one room without a
// network. It exists only when the test exposes `__sdRelayOut` on the page; the site never has it.
import { Listeners, type OpenRelay, type Peer, type Relay, type RelayStatus } from '../../engine/team/relay';

/** What a page tells the test process. */
export type BridgeOut = { kind: 'join'; channel: string; me: Peer } | { kind: 'send'; channel: string; from: string; msg: unknown } | { kind: 'leave'; channel: string; key: string };

/** What the test process tells a page. */
export type BridgeIn = { kind: 'status'; channel: string; key: string; status: RelayStatus } | { kind: 'peers'; channel: string; peers: Peer[] } | { kind: 'msg'; channel: string; to: string; msg: unknown };

interface BridgeWindow {
  __sdRelayOut?: (json: string) => Promise<void>;
  __sdRelayIn?: (json: string) => void;
}

const relays = new Set<BridgeRelay<unknown>>();

/** The bridge opener, when the page runs under the Playwright room test. */
export function bridgeOpener<M>(): OpenRelay<M> | undefined {
  const w = (typeof window === 'undefined' ? {} : window) as BridgeWindow;
  const out = w.__sdRelayOut;
  if (!out) return undefined;
  w.__sdRelayIn ??= (json: string) => {
    const e = JSON.parse(json) as BridgeIn;
    for (const r of relays) r.hear(e);
  };
  return (channel, me) => new BridgeRelay<M>(channel, me, (e) => void out(JSON.stringify(e)));
}

class BridgeRelay<M> implements Relay<M> {
  private messages = new Listeners<M>();
  private peers = new Listeners<Peer[]>();
  private status = new Listeners<RelayStatus>();
  private current: RelayStatus = 'connecting';

  constructor(
    private channel: string,
    private me: Peer,
    private out: (e: BridgeOut) => void,
  ) {
    relays.add(this as BridgeRelay<unknown>);
    out({ kind: 'join', channel, me });
  }

  hear(e: BridgeIn) {
    if (e.channel !== this.channel) return;
    if (e.kind === 'status' && e.key === this.me.key) {
      this.current = e.status;
      this.status.emit(e.status);
    } else if (e.kind === 'peers') this.peers.emit(e.peers);
    else if (e.kind === 'msg' && e.to === this.me.key) this.messages.emit(e.msg as M);
  }

  send(msg: M): void {
    this.out({ kind: 'send', channel: this.channel, from: this.me.key, msg });
  }
  onMessage(fn: (msg: M) => void) {
    return this.messages.add(fn);
  }
  onPeers(fn: (peers: Peer[]) => void) {
    return this.peers.add(fn);
  }
  onStatus(fn: (s: RelayStatus) => void) {
    const off = this.status.add(fn);
    fn(this.current);
    return off;
  }
  close(): void {
    relays.delete(this as BridgeRelay<unknown>);
    this.out({ kind: 'leave', channel: this.channel, key: this.me.key });
  }
}
