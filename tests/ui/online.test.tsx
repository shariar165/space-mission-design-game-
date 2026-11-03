// @vitest-environment jsdom
// The Online Mission Room on screen (spec: Online room; design screens T6, T7). The host screen and the phones talk
// over MemoryHub, an in-memory relay injected in place of Supabase. One side is the real App; the other is played with
// the engine's OnlineHost / OnlineClient, so each test drives one screen the way a player would.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { shelfFor } from '../../src/engine/pack';
import { OnlineClient, OnlineHost, type RoomMsg } from '../../src/engine/team/online';
import { MemoryHub } from '../../src/engine/team/relay';
import { TEAM_RULES } from '../../src/engine/team/roles';
import { actorFor } from '../../src/engine/team/setup';
import { App } from '../../src/ui/App';
import { injectRelay } from '../../src/ui/online/relay';
import { CONTROLLER_WORDS, JOIN_WORDS, OBJECTIVE_WORDS, ONLINE_WORDS, ROLE_WORDS, TEAM_WORDS } from '../../src/ui/sdWords';
import { starterDesign } from '../../src/ui/starters';
import './setup';

const btn = (name: string | RegExp) => screen.getByRole('button', { name });
const SIGNS = TEAM_RULES.callSigns.value;
const mission = { base: starterDesign('mars', '2028-11-15'), shelf: shelfFor('mars'), seed: 19 };

function hub(offline = false) {
  const h = new MemoryHub<RoomMsg>(true);
  h.offline = offline;
  injectRelay(h.open);
  return { hub: h, deps: { open: h.open, now: Date.now, rand: Math.random } };
}

afterEach(() => injectRelay(undefined));

/** Home → TEAM → ONLINE ROOM → NEXT · OPEN ROOM. */
function openRoom() {
  render(<App />);
  fireEvent.click(btn(new RegExp(`^${TEAM_WORDS.menu}: `)));
  fireEvent.click(btn(new RegExp(`^${TEAM_WORDS.online}`)));
  fireEvent.click(btn(TEAM_WORDS.nextRoom));
}

describe('the host screen (T6a)', () => {
  it('shows the room code; phones fill the slots; START needs a Flight Director; the phones then run the objective', async () => {
    const { deps } = hub();
    openRoom();
    const code = await waitFor(() => {
      const el = document.querySelector('.ol-code');
      expect(el?.textContent).toMatch(/^[A-Z]{4}-[A-Z0-9]{3}$/);
      return el!.textContent!;
    });
    expect((btn(ONLINE_WORDS.start) as HTMLButtonElement).disabled).toBe(true);
    const fd = new OnlineClient(deps, code, 'ph-fd');
    const sci = new OnlineClient(deps, code, 'ph-sci');
    await waitFor(() => expect(sci.state.me).toBeDefined());
    sci.pick('science-lead');
    await waitFor(() => expect(screen.getByText(ONLINE_WORDS.slotJoined(SIGNS[1]!))).toBeTruthy());
    expect(screen.getByText(ONLINE_WORDS.msgNeedDirector)).toBeTruthy();
    fd.pick('flight-director');
    // the Engineer and Comms & Ops are empty: the Flight Director's phone will hold them
    await waitFor(() => expect(screen.getByText(ONLINE_WORDS.msgEmpty(TEAM_WORDS.join(['ENG', 'COM']), SIGNS[0]!))).toBeTruthy());
    fireEvent.click(btn(ONLINE_WORDS.start));
    await waitFor(() => expect(document.querySelector('.tm.ob')).toBeTruthy());
    // the phones vote; the host screen goes on to packing by itself once the objective locks
    await waitFor(() => expect(fd.log().length).toBe(1));
    fd.act('flight-director', { kind: 'objective', objective: 'surface' });
    await waitFor(() => expect(fd.log().length).toBe(2));
    sci.act('science-lead', { kind: 'objective-voice', voice: 'agree' });
    await waitFor(() => expect(fd.log().length).toBe(3));
    fd.act('flight-director', { kind: 'objective-lock' });
    await waitFor(() => expect(fd.state.room?.stage).toBe('pack'));
    expect(document.querySelector('.ol-bar')?.textContent).toContain(code);
  });

  it('a relay that is offline says so and offers local co-op, which goes back to Team Setup', async () => {
    hub(true);
    openRoom();
    await waitFor(() => expect(screen.getByText(ONLINE_WORDS.offline)).toBeTruthy());
    expect(screen.getByText(ONLINE_WORDS.chipOffline)).toBeTruthy();
    fireEvent.click(btn(new RegExp(`^${ONLINE_WORDS.local}`)));
    expect(btn(new RegExp(`^${TEAM_WORDS.local}`)).getAttribute('aria-pressed')).toBe('true');
    expect(btn(TEAM_WORDS.next)).toBeTruthy();
  });

  it('with no relay set up (no key; component tests blank the project in setup.ts) the room says so', async () => {
    openRoom();
    await waitFor(() => expect(screen.getByText(ONLINE_WORDS.msgNotSetUp)).toBeTruthy());
  });
});

describe('a phone (T6b, T7b, the controller)', () => {
  it('joins with the code, picks a free role, waits, then shows only its own role’s switches', async () => {
    const { deps } = hub();
    const host = new OnlineHost(deps, mission, 'MARS-7K2', 'K7QB-000');
    const fd = new OnlineClient(deps, 'MARS-7K2', 'ph-fd');
    await waitFor(() => expect(fd.state.me).toBeDefined());
    fd.pick('flight-director');
    render(<App />);
    fireEvent.click(btn(new RegExp(`^${ONLINE_WORDS.menu}: `)));
    fireEvent.change(screen.getByLabelText(JOIN_WORDS.codeInput), { target: { value: 'mars7k2' } });
    // the Flight Director is taken (by its call sign); the Science Lead is free
    await waitFor(() => expect((btn(new RegExp(ROLE_WORDS['science-lead'].name)) as HTMLButtonElement).disabled).toBe(false));
    expect((btn(new RegExp(ROLE_WORDS['flight-director'].name)) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(btn(new RegExp(ROLE_WORDS['science-lead'].name)));
    fireEvent.click(btn(JOIN_WORDS.joinAs(ROLE_WORDS['science-lead'].name)));
    await waitFor(() => expect(screen.getByText(CONTROLLER_WORDS.waiting)).toBeTruthy());
    expect(screen.getByText(CONTROLLER_WORDS.youAre(SIGNS[1]!))).toBeTruthy();

    // the host starts; the Flight Director picks the objective on its phone
    const team = host.start()!;
    host.send({ seat: actorFor(team, 'flight-director'), role: 'flight-director', act: { kind: 'setup', team } });
    host.setStage('objective');
    fd.act('flight-director', { kind: 'objective', objective: 'atmosphere' });
    // this phone is the Science Lead: it may agree or object, but not pick or lock
    const voice = () => within(document.querySelector('.ol-voice') as HTMLElement).getByRole('button', { name: OBJECTIVE_WORDS.agree }) as HTMLButtonElement;
    await waitFor(() => expect(voice().disabled).toBe(false));
    expect(screen.queryByRole('button', { name: OBJECTIVE_WORDS.lock })).toBeNull();
    expect((btn(new RegExp(`^${OBJECTIVE_WORDS.objectives.surface.title}`)) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(voice());
    await waitFor(() => expect(host.log().some((a) => a.act.kind === 'objective-voice' && a.role === 'science-lead' && a.seat === 'p2')).toBe(true));
  });

  it('the host screen leaving ends the room on the phone, with its resume code', async () => {
    const { deps } = hub();
    const host = new OnlineHost(deps, mission, 'MARS-7K2', 'K7QB-000');
    render(<App />);
    fireEvent.click(btn(new RegExp(`^${ONLINE_WORDS.menu}: `)));
    fireEvent.change(screen.getByLabelText(JOIN_WORDS.codeInput), { target: { value: 'MARS-7K2' } });
    await waitFor(() => expect((btn(new RegExp(ROLE_WORDS['flight-director'].name)) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(btn(new RegExp(ROLE_WORDS['flight-director'].name)));
    fireEvent.click(btn(JOIN_WORDS.joinAs(ROLE_WORDS['flight-director'].name)));
    await waitFor(() => expect(screen.getByText(CONTROLLER_WORDS.waiting)).toBeTruthy());
    host.close('ended');
    await waitFor(() => expect(screen.getByText(CONTROLLER_WORDS.ended)).toBeTruthy());
    expect(screen.getByText('K7QB-000')).toBeTruthy();
  });
});
