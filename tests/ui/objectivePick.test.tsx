// @vitest-environment jsdom
// SOLO OBJECTIVE (spec UI rule 56): on Red Planet a solo player picks the mission objective in the briefing before
// packing. START waits for the pick; Pack shows the objective and whether a part for it is on board (engine
// objectiveCards on the packed craft); the launch checklist starts with it; in flight MISSION INFO shows it read-only.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/ui/App';
import { LAUNCH_CHECKS, NAV, OBJECTIVE_PICK_WORDS as OP, OBJECTIVE_WORDS } from '../../src/ui/sdWords';
import { loadLevelPacks } from '../../src/ui/saves';
import './setup';

function pass(ms: number, step = 50) {
  for (let t = 0; t < ms; t += step) act(() => vi.advanceTimersByTime(step));
}

function open(level: RegExp, seen: string[] = ['name']) {
  vi.useFakeTimers();
  localStorage.setItem('sd.seen', JSON.stringify(seen));
  localStorage.setItem('mdt.progress', JSON.stringify({ 'moon-1': 1, 'moon-2': 1, 'moon-3': 1 }));
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'CHOOSE A MISSION ▸' }));
  fireEvent.click(screen.getByRole('button', { name: level }));
  pass(100); // the calendar is worked out one tick after the screen paints
}

const title = (id: keyof typeof OBJECTIVE_WORDS.objectives) => OBJECTIVE_WORDS.objectives[id].title;
const radio = (id: keyof typeof OBJECTIVE_WORDS.objectives) => screen.getByRole('radio', { name: new RegExp(`^${title(id)}`) });
const plate = () => screen.getByRole('status', { name: OP.group });

describe('solo objective: the Red Planet briefing', () => {
  it('asks for one of the three objectives; START waits for a pick and Escape does not skip it', () => {
    open(/^Red Planet/);
    const brief = screen.getByRole('dialog', { name: 'Mission briefing' });
    expect(within(brief).getByText(OP.heading)).toBeTruthy();
    expect(within(brief).getAllByRole('radio')).toHaveLength(3);
    // the starter carries the sniffer, so the atmosphere card already says ON BOARD
    expect(within(radio('atmosphere')).getByText(OP.onBoard)).toBeTruthy();
    expect(within(radio('surface')).queryByText(OP.onBoard)).toBeNull();
    const start = within(brief).getByRole('button', { name: OP.startLocked }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Mission briefing' })).toBeTruthy();
    // a way out while nothing is picked
    expect(within(brief).getByRole('button', { name: NAV.backLabel })).toBeTruthy();

    fireEvent.click(radio('surface'));
    expect(radio('surface').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(brief).getByRole('button', { name: NAV.start }));
    expect(screen.queryByRole('dialog', { name: 'Mission briefing' })).toBeNull();
  });

  it('a returning player who has seen the briefing still gets the picker', () => {
    open(/^Red Planet/, ['name', 'brief:mars']);
    expect(within(screen.getByRole('dialog', { name: 'Mission briefing' })).getAllByRole('radio')).toHaveLength(3);
  });

  it('the Moon levels have no objective: no picker, no plate, no checklist item', () => {
    open(/^First Light/);
    const brief = screen.getByRole('dialog', { name: 'Mission briefing' });
    expect(within(brief).queryAllByRole('radio')).toHaveLength(0);
    fireEvent.click(within(brief).getByRole('button', { name: NAV.start }));
    expect(screen.queryByRole('status', { name: OP.group })).toBeNull();
    expect(screen.queryByText(LAUNCH_CHECKS.objective)).toBeNull();
  });
});

describe('solo objective: Pack', () => {
  it('the plate follows the packed craft: NOT PACKED with the starter, ON BOARD once the camera is in', () => {
    open(/^Red Planet/);
    fireEvent.click(radio('surface'));
    fireEvent.click(screen.getByRole('button', { name: NAV.start }));
    expect(within(plate()).getByText(title('surface'))).toBeTruthy();
    expect(within(plate()).getByText(OP.notOnBoard)).toBeTruthy();
    expect(within(plate()).getByText(OP.warn(`CAMERA${OBJECTIVE_WORDS.or}RADAR`))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Unpack Air sniffer (MAVEN suite)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pack Camera' }));
    expect(within(plate()).getByText(OP.onBoard)).toBeTruthy();
    expect(within(plate()).queryByText(OP.warn(`CAMERA${OBJECTIVE_WORDS.or}RADAR`))).toBeNull();
  });

  it('CHANGE ▸ reopens the briefing with the pick kept, and a new pick replaces it', () => {
    open(/^Red Planet/);
    fireEvent.click(radio('surface'));
    fireEvent.click(screen.getByRole('button', { name: NAV.start }));
    fireEvent.click(screen.getByRole('button', { name: OP.changeLabel }));
    expect(radio('surface').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(radio('moons'));
    fireEvent.click(screen.getByRole('button', { name: NAV.start }));
    expect(within(plate()).getByText(title('moons'))).toBeTruthy();
  });

  it('the launch checklist starts with the objective, ticked once picked', () => {
    open(/^Red Planet/);
    const item = () => screen.getByRole('checkbox', { name: LAUNCH_CHECKS.objective });
    expect(item().getAttribute('aria-checked')).toBe('false');
    fireEvent.click(radio('atmosphere'));
    expect(item().getAttribute('aria-checked')).toBe('true');
  });

  it('the flight carries the pick: MISSION INFO in flight shows the objective flown, read-only', () => {
    open(/^Red Planet/, ['name', 'coach', 'launch:mars']);
    fireEvent.click(radio('moons'));
    fireEvent.click(screen.getByRole('button', { name: NAV.start }));
    fireEvent.click(screen.getByRole('switch', { name: 'Arm' }));
    fireEvent.click(screen.getByRole('button', { name: 'LAUNCH' }));
    pass(100);
    fireEvent.click(screen.getByRole('button', { name: NAV.info }));
    const brief = screen.getByRole('dialog', { name: 'Mission briefing' });
    expect(within(brief).getByText(OP.yours)).toBeTruthy();
    const shown = within(brief).getAllByRole('radio');
    expect(shown).toHaveLength(1);
    expect(within(shown[0]!).getByText(title('moons'))).toBeTruthy();
    expect(shown[0]!.tagName).not.toBe('BUTTON');
  });
});

describe('solo objective: a reload keeps the packing and the pick (sd.pack)', () => {
  /** A reload: the app is gone, the browser's storage stays, and the player opens Red Planet again from Home. */
  function reload() {
    cleanup();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'CHOOSE A MISSION ▸' }));
    fireEvent.click(screen.getByRole('button', { name: /^Red Planet/ }));
    pass(100);
  }

  it('reopening Red Planet after a reload restores the objective and the packed parts; no picker in the way', () => {
    open(/^Red Planet/);
    fireEvent.click(radio('surface'));
    fireEvent.click(screen.getByRole('button', { name: NAV.start }));
    fireEvent.click(screen.getByRole('button', { name: 'Unpack Air sniffer (MAVEN suite)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pack Camera' }));
    expect(loadLevelPacks().mars).toEqual({ parts: expect.arrayContaining(['computer', 'engine', 'camera']), objective: 'surface', rocket: 'atlas-v-401', orbit: 'maven' });
    reload();
    expect(screen.queryByRole('dialog', { name: 'Mission briefing' })).toBeNull();
    expect(within(plate()).getByText(title('surface'))).toBeTruthy();
    expect(within(plate()).getByText(OP.onBoard)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unpack Camera' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pack Air sniffer (MAVEN suite)' })).toBeTruthy();
  });

  it('a stale or edited save cannot break Pack: unknown parts and objectives are dropped, the rest re-packed', () => {
    localStorage.setItem('sd.pack', JSON.stringify({ mars: { parts: ['computer', 'engine', 'warp-drive', 7, 'camera'], objective: 'party' }, junk: 3 }));
    expect(loadLevelPacks()).toEqual({ mars: { parts: ['computer', 'engine', 'warp-drive', 'camera'], objective: 'party' } });
    open(/^Red Planet/);
    // the objective was not one of the three: the picker asks again; the camera is packed, the unknown part is not
    expect(screen.getByRole('dialog', { name: 'Mission briefing' })).toBeTruthy();
    fireEvent.click(radio('atmosphere'));
    fireEvent.click(screen.getByRole('button', { name: NAV.start }));
    expect(screen.getByRole('button', { name: 'Unpack Camera' })).toBeTruthy();
  });
});
