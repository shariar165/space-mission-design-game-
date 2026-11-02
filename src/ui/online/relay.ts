// Which relay the Online Room talks through (spec: Online room): a relay a component test injected, the Playwright
// bridge, or Supabase Realtime when the project is set up in online.json. Without one the room is offline and offers
// local co-op.
import type { RoomMsg } from '../../engine/team/online';
import type { OpenRelay } from '../../engine/team/relay';
import { relayConfigured } from '../../engine/team/room';
import { bridgeOpener } from './bridgeRelay';

export type RoomOpener = OpenRelay<RoomMsg>;

let injected: RoomOpener | undefined;

/** Component tests: play the room over an in-memory relay (MemoryHub). */
export function injectRelay(open: RoomOpener | undefined): void {
  injected = open;
}

/** 'not-set-up': no relay project in online.json; 'unreachable': the relay's code could not even load. */
export type NoRelay = 'not-set-up' | 'unreachable';

export async function roomOpener(): Promise<RoomOpener | NoRelay> {
  if (injected) return injected;
  const bridge = bridgeOpener<RoomMsg>();
  if (bridge) return bridge;
  if (!relayConfigured()) return 'not-set-up';
  try {
    const { supabaseOpener } = await import('./supabaseRelay');
    return await supabaseOpener<RoomMsg>();
  } catch {
    return 'unreachable';
  }
}
