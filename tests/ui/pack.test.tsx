// @vitest-environment jsdom
// PACK (Signal Delay screen 02): the nose is volume, weight is a separate limit; every number is pack.ts /
// evaluateDesign output. The Mars level (all parts) and the Moon and Jupiter lessons.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { evaluateDesign } from '../../src/engine/index';
import { buildPackDesign, initialPack, noseSquares, packBlockers, shelfFor } from '../../src/engine/pack';
import { App } from '../../src/ui/App';
import * as f from '../../src/ui/format';
import { LEVELS, loadProgress, shelfOf } from '../../src/ui/levels';
import { starterDesign, today } from '../../src/ui/starters';
import './setup';

function pass(ms: number, step = 50) {
  for (let t = 0; t < ms; t += step) act(() => vi.advanceTimersByTime(step));
}

function openLevel(title: RegExp, progress: Record<string, number>) {
  vi.useFakeTimers();
  localStorage.setItem('mdt.progress', JSON.stringify(progress));
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'CHOOSE A MISSION ▸' }));
  fireEvent.click(screen.getByRole('button', { name: title }));
  pass(100); // the calendar is worked out one tick after the screen paints
}

const MARS = { 'moon-1': 1, 'moon-2': 1, 'moon-3': 1 };

describe('Pack: the nose and the shelf', () => {
  it('opens with the locked computer and engine plus the starter’s instruments; squares left come from the engine', () => {
    openLevel(/^Red Planet/, MARS);
    const base = starterDesign('mars', today());
    const p = initialPack(base, shelfFor('mars'));
    expect(screen.getByText(`${f.num(noseSquares(p).free)} SQUARES LEFT`)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Flight computer (always packed)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Main engine (always packed)' })).toBeTruthy();
  });

  it('tap a shelf part to pack it, tap it in the nose to unpack it', () => {
    openLevel(/^Red Planet/, MARS);
    const before = screen.getByText(/SQUARES LEFT/).textContent!;
    fireEvent.click(screen.getByRole('button', { name: 'Pack Radiation shield' }));
    expect(screen.getByText(/SQUARES LEFT/).textContent).not.toBe(before);
    expect(screen.queryByRole('button', { name: 'Pack Radiation shield' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Unpack Radiation shield' }));
    expect(screen.getByText(/SQUARES LEFT/).textContent).toBe(before);
  });

  it('the danger deck stamps react to what is packed (two parts cover eclipse season)', () => {
    openLevel(/^Red Planet/, MARS);
    const deck = within(screen.getByRole('list', { name: 'Danger deck' }));
    expect(deck.getByRole('listitem', { name: 'ECLIPSE SEASON: NOT COVERED' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pack Extra solar panel' }));
    expect(deck.getByRole('listitem', { name: 'ECLIPSE SEASON: SOME COVER' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pack Big battery' }));
    expect(deck.getByRole('listitem', { name: 'ECLIPSE SEASON: COVERED' })).toBeTruthy();
  });

  it('a part with no free slot cannot be packed and says why: no room in the nose', () => {
    openLevel(/^Red Planet/, MARS);
    for (const name of ['Extra fuel tank', 'Radiation shield', 'Big dish antenna', 'Camera', 'Extra solar panel', 'Debris bumper', 'Spectrometer', 'Big battery', 'Autopilot chip']) {
      const b = screen.queryByRole('button', { name: `Pack ${name}` });
      if (b) fireEvent.click(b);
    }
    const nofit = screen.getAllByRole('button', { name: /\(no room\)$/ });
    expect(nofit.length).toBeGreaterThan(0);
    fireEvent.click(nofit[0]!);
    expect(screen.getByText(/NO ROOM IN THE NOSE/)).toBeTruthy();
  });
});

describe('Pack: weight, launch day, arm and launch', () => {
  it('the weight scale beside the nose is the launch meter; overloading names the limit: too heavy for this rocket', () => {
    const base = starterDesign('mars', today());
    const p = initialPack(base, shelfFor('mars'));
    const heavy = { ...buildPackDesign(base, p), propellant_kg: 20000 };
    expect(packBlockers(p, evaluateDesign(heavy)).map((b) => b.code)).toContain('too-heavy');
    openLevel(/^Red Planet/, MARS);
    expect(screen.getByRole('meter', { name: 'Weight' })).toBeTruthy();
    expect(screen.getByText('LIGHT ENOUGH')).toBeTruthy();
  });

  it('LAUNCH needs the arm lever and a day that is not bad; it flies the packed craft in Fly & Survive', () => {
    openLevel(/^Red Planet/, MARS);
    const go = screen.getByRole('button', { name: 'LAUNCH' }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.click(screen.getByRole('switch', { name: 'Arm' }));
    expect(go.disabled).toBe(false); // the best day (selected) is good
    // a bad day disarms the launch
    const days = within(screen.getByRole('radiogroup', { name: 'Launch day' })).getAllByRole('radio');
    expect(days.length).toBe(42);
    const bad = days.find((d) => /BAD$/.test(d.getAttribute('aria-label')!));
    if (bad) {
      fireEvent.click(bad);
      expect(go.disabled).toBe(true);
      fireEvent.click(days[20]!);
    }
    fireEvent.click(go);
    pass(100);
    expect(screen.getByRole('list', { name: 'Robot resources' })).toBeTruthy();
  });
});

describe('Pack: levels', () => {
  it('Moon 1 teaches power: a small shelf', () => {
    openLevel(/^First Light/, {});
    expect(screen.getByRole('button', { name: 'Pack Extra solar panel' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pack Radiation shield' })).toBeNull();
  });

  it('every level’s starting pack is flyable, except Jupiter, which no rocket can throw there directly', () => {
    for (const l of LEVELS) {
      const base = starterDesign(l.destination, today());
      const p = initialPack(base, shelfOf(l));
      const b = packBlockers(p, evaluateDesign(buildPackDesign(base, p)));
      if (l.impossible) expect(b.map((x) => x.code), l.id).toContain('too-heavy');
      else expect(b, l.id).toEqual([]);
    }
  });

  it('Jupiter: the lesson card shows the sourced Juno story and gives the star', () => {
    openLevel(/^Giant Leap/, Object.fromEntries(LEVELS.slice(0, -1).map((l) => [l.id, 1])));
    expect(screen.getByText(/TOO HEAVY FOR THIS ROCKET/)).toBeTruthy();
    expect(screen.getByText(/gravity assist/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Source of the lesson/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '★ LESSON LEARNED' }));
    expect(loadProgress().jupiter).toBe(1);
  });
});
