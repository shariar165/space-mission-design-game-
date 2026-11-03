// The Online Room's relay on Supabase Realtime (spec: Online room): one broadcast channel per room code, with
// presence keyed by the host's or the phone's random key. Only the project's public publishable key is used (it is
// meant to be in a web page); nothing is stored on the server. Loaded only when a room opens (a lazy import), so solo
// players never download it.
import type { RealtimeClient } from '@supabase/realtime-js';
import type { RealtimeChannel } from '@supabase/realtime-js';
import { Listeners, type OpenRelay, type Peer, type PeerKind, type Relay, type RelayStatus } from '../../engine/team/relay';
import { ONLINE_RULES, RELAY_CONFIG } from '../../engine/team/room';

let client: RealtimeClient | undefined;

/** The relay opener for this project (one socket for the page; one channel per room). */
export async function supabaseOpener<M>(): Promise<OpenRelay<M>> {
  if (!client) {
    const { RealtimeClient: Client } = await import('@supabase/realtime-js');
    client = new Client(`${RELAY_CONFIG.url.replace(/\/$/, '')}/realtime/v1`, { params: { apikey: RELAY_CONFIG.publishableKey } });
  }
  const c = client;
  return (channel, me) => new SupabaseRelay<M>(c, channel, me);
}

class SupabaseRelay<M> implements Relay<M> {
  private ch: RealtimeChannel;
  private messages = new Listeners<M>();
  private peers = new Listeners<Peer[]>();
  private status = new Listeners<RelayStatus>();
  private current: RelayStatus = 'connecting';
  private wasOpen = false;

  constructor(client: RealtimeClient, channel: string, private me: Peer) {
    this.ch = client.channel(channel, { config: { broadcast: { self: false }, presence: { key: me.key, enabled: true } } });
    this.ch.on('broadcast', { event: 'm' }, ({ payload }) => this.messages.emit(payload as M));
    this.ch.on('presence', { event: 'sync' }, () => this.peers.emit(this.list()));
    this.ch.subscribe((st) => {
      if (st === 'SUBSCRIBED') {
        this.wasOpen = true;
        void this.ch.track({ kind: this.me.kind });
        this.set('open');
      } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') this.set(this.wasOpen ? 'connecting' : 'offline');
      else if (st === 'CLOSED' && this.wasOpen) this.set('connecting');
    }, ONLINE_RULES.connectTimeout_s.value * 1000);
  }

  private set(s: RelayStatus) {
    this.current = s;
    this.status.emit(s);
  }

  private list(): Peer[] {
    const state = this.ch.presenceState<{ kind: PeerKind }>();
    return Object.entries(state).map(([key, metas]) => ({ key, kind: metas[0]?.kind === 'host' ? 'host' : 'phone' }));
  }

  send(msg: M): void {
    void this.ch.send({ type: 'broadcast', event: 'm', payload: msg });
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
    void this.ch.unsubscribe();
  }
}
