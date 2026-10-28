// @vitest-environment jsdom
// The cold open (spec UI rule 47): a new player's first launch opens on black with Mars Climate Orbiter's arrival,
// told from the MCO rescue case's Sourced facts (engine coldOpenFacts), in about 15 s, then Name Your Robot, then
// Home. It waits behind a one-tap gate (▶ RECEIVE TRANSMISSION) so the sound can start. SKIP is always there (and
// Esc); Home's INTRO key replays it; reduced motion keeps every pause short.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { coldOpenFacts } from '../../src/engine/rescue';
import { App } from '../../src/ui/App';
import * as f from '../../src/ui/format';
import { COLD_OPEN_HOLD_MS, COLD_OPEN_STILL_MS } from '../../src/ui/screens/ColdOpen';
import { loadSeen } from '../../src/ui/saves';
import { COLD_OPEN } from '../../src/ui/sdWords';
import { sound } from '../../src/ui/sound';
import { Ctx } from './fakeAudio';
import './setup';

/** Fake time in slices of the teletype's tick (33 ms): each typed character schedules the next after a render. */
function pass(ms: number, step = 33) {
  for (let t = 0; t < ms; t += step) act(() => vi.advanceTimersByTime(step));
}

/** A brand-new player: nothing seen, no robot name. */
function newPlayer({ tap = true } = {}) {
  localStorage.removeItem('sd.seen');
  localStorage.removeItem('sd.robot');
  vi.useFakeTimers();
  render(<App />);
  if (tap) fireEvent.click(receive()!);
}

const cold = () => screen.queryByRole('main', { name: COLD_OPEN.label });
const beat = () => cold()?.getAttribute('data-beat');
const skip = () => screen.getByRole('button', { name: COLD_OPEN.skip });
const receive = () => screen.queryByRole('button', { name: COLD_OPEN.receive });
const nameScreen = () => screen.queryByRole('main', { name: 'Name your robot' });
const home = () => screen.queryByRole('button', { name: /^Play: mission/ });

describe('the cold open', () => {
  it('plays on the first launch: the MCO lines in order from the Sourced facts, about 15 s, SKIP always there, then the name screen', () => {
    newPlayer();
    expect(cold()).toBeTruthy();
    expect(home()).toBeNull();
    const facts = coldOpenFacts();
    const burn = COLD_OPEN.burn(f.longDate(facts.arrival.value), facts.craft);
    expect(burn).toBe('SEPTEMBER 23, 1999 · MARS CLIMATE ORBITER · ORBIT INSERTION BURN');
    const order: string[] = [];
    let t = 0;
    while (cold() && t < 30_000) {
      const b = beat()!;
      if (order[order.length - 1] !== b) order.push(b);
      expect(skip()).toBeTruthy();
      pass(99);
      t += 99;
    }
    expect(order).toEqual(['burn', 'expected', 'wait', 'lost', 'units', 'moral']);
    // holds 8.4 s + typing (64 + 50 + 13 + 41 + 49 = 217 characters, one per 33 ms ≈ 7.2 s) ≈ 15.6 s
    const holds = Object.values(COLD_OPEN_HOLD_MS).reduce((a, b) => a + b, 0);
    expect(holds).toBe(8400);
    expect(t).toBeGreaterThanOrEqual(12_000);
    expect(t).toBeLessThanOrEqual(17_000);
    expect(nameScreen()).toBeTruthy();
    expect(loadSeen()).toContain('cold-open');
    // SKIP on the name screen goes Home (not to packing): the first launch lands there
    fireEvent.click(screen.getByRole('button', { name: /^SKIP · CALL IT/ }));
    expect(home()).toBeTruthy();
  });

  it('waits on black behind ▶ RECEIVE TRANSMISSION: nothing types or sounds until the tap, which lets the sound start', () => {
    vi.stubGlobal('AudioContext', Ctx);
    newPlayer({ tap: false });
    expect(beat()).toBe('gate');
    expect(cold()!.textContent).toBe('█' + COLD_OPEN.receive);
    expect(skip()).toBeTruthy();
    pass(5000);
    // it waits as long as it takes
    expect(beat()).toBe('gate');
    expect(screen.queryByText(/ORBIT INSERTION BURN/)).toBeNull();
    expect(sound.playing()).toEqual([]);
    fireEvent.click(receive()!);
    expect(sound.unlocked()).toBe(true);
    expect(beat()).toBe('burn');
    expect(sound.playing()).toContain('clack');
  });

  it('prints each line from the data, the wait hisses with static, and the second screen credits the board report', () => {
    vi.stubGlobal('AudioContext', Ctx);
    newPlayer();
    while (beat() !== 'wait') pass(33);
    expect(screen.getByText('SEPTEMBER 23, 1999 · MARS CLIMATE ORBITER · ORBIT INSERTION BURN')).toBeTruthy();
    expect(screen.getAllByText('SIGNAL EXPECTED WHEN IT COMES OUT FROM BEHIND MARS').length).toBeGreaterThan(0);
    expect(screen.getByText(COLD_OPEN.waiting)).toBeTruthy();
    expect(sound.playing()).toContain('static');
    while (beat() !== 'units') pass(33);
    expect(sound.playing()).not.toContain('static');
    expect(screen.queryByText(COLD_OPEN.expected)).toBeNull();
    expect(screen.getByText('SOURCE · MCO MISHAP INVESTIGATION BOARD PHASE I REPORT')).toBeTruthy();
    while (beat() !== 'moral') pass(33);
    expect(screen.getAllByText(COLD_OPEN.units).length).toBeGreaterThan(0);
  });

  it('SKIP (or Esc) ends it at once and is remembered: the next launch opens on Home', () => {
    newPlayer();
    pass(500);
    fireEvent.click(skip());
    expect(cold()).toBeNull();
    expect(nameScreen()).toBeTruthy();
    expect(loadSeen()).toContain('cold-open');
  });

  it('Esc skips too', () => {
    newPlayer();
    pass(300);
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(nameScreen()).toBeTruthy();
  });

  it('a returning player (name screen seen) opens on Home; INTRO on the second row replays it and comes back Home', () => {
    vi.useFakeTimers();
    render(<App />);
    expect(cold()).toBeNull();
    expect(home()).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${COLD_OPEN.menu}:`) }));
    expect(cold()).toBeTruthy();
    fireEvent.click(receive()!);
    pass(17_000);
    expect(cold()).toBeNull();
    expect(nameScreen()).toBeNull();
    expect(home()).toBeTruthy();
  });

  it('reduced motion with the sound muted: no gate; every line prints whole and the pauses are short (under 4 s in all)', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }));
    sound.setOn(false);
    newPlayer({ tap: false });
    expect(receive()).toBeNull();
    expect(cold()!.textContent).toContain('SEPTEMBER 23, 1999 · MARS CLIMATE ORBITER · ORBIT INSERTION BURN█');
    // six beats of 0.6 s
    expect(6 * COLD_OPEN_STILL_MS).toBe(3600);
    pass(3600 + 300);
    expect(cold()).toBeNull();
    expect(nameScreen()).toBeTruthy();
  });

  it('reduced motion with the sound on still shows the gate (the tap is what lets the sound start)', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }));
    sound.setOn(true);
    newPlayer({ tap: false });
    expect(beat()).toBe('gate');
    fireEvent.click(receive()!);
    expect(cold()!.textContent).toContain('ORBIT INSERTION BURN█');
  });
});
