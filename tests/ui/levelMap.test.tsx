// @vitest-environment jsdom
// Level map: unlocks, stars that persist, one idea per level, and the Jupiter "impossible" lesson.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildCadetDesign, defaultChoices } from '../../src/engine/cadet';
import { evaluateDesign } from '../../src/engine/index';
import { App } from '../../src/ui/App';
import { LevelBanner } from '../../src/ui/components/LevelCards';
import { TEST_FLIGHT_MS } from '../../src/ui/components/TestFlight';
import { LEVELS, loadProgress } from '../../src/ui/levels';
import { starterDesign, today } from '../../src/ui/starters';
import './setup';

const levelButton = (title: RegExp) => screen.getByRole('button', { name: title });

describe('Level map', () => {
  it('Cadet mode opens on the map; only the first Moon level is open', () => {
    render(<App />);
    expect(screen.getByText('Where will you fly next?')).toBeTruthy();
    expect((levelButton(/^First Light/) as HTMLButtonElement).disabled).toBe(false);
    expect((levelButton(/^Heavy Lifting/) as HTMLButtonElement).disabled).toBe(true);
    expect((levelButton(/^Giant Leap/) as HTMLButtonElement).disabled).toBe(true);
  });

  it('a star on a level opens the next one, and stars persist between visits', () => {
    localStorage.setItem('mdt.progress', JSON.stringify({ 'moon-1': 2 }));
    render(<App />);
    expect((levelButton(/^Heavy Lifting/) as HTMLButtonElement).disabled).toBe(false);
    expect((levelButton(/^Full Build/) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: /^First Light/ }).textContent).toContain('First Light');
  });

  it('Moon 1 opens only the Power step, with no standing orders', () => {
    render(<App />);
    fireEvent.click(levelButton(/^First Light/));
    expect(screen.getByText(/Step 1 of 1 — Power/)).toBeTruthy();
    const nav = within(screen.getByRole('navigation', { name: 'Build steps' }));
    expect(nav.queryByRole('button', { name: 'Orders' })).toBeNull();
  });

  it('Mars teaches light delay: all five steps plus standing orders', () => {
    localStorage.setItem('mdt.progress', JSON.stringify({ 'moon-1': 1, 'moon-2': 1, 'moon-3': 1 }));
    render(<App />);
    fireEvent.click(levelButton(/^Red Planet/));
    expect(screen.getByText(/Step 1 of 5 — Science/)).toBeTruthy();
    expect(within(screen.getByRole('navigation', { name: 'Build steps' })).getByRole('button', { name: 'Orders' })).toBeTruthy();
  });

  it('every level starts flyable, except Jupiter, which cannot leave Earth (its lesson)', () => {
    for (const l of LEVELS) {
      const base = starterDesign(l.destination, today());
      const ev = evaluateDesign(buildCadetDesign(base, defaultChoices(base)));
      if (l.impossible) expect(ev.meters.mass.status, l.id).toBe('over');
      else expect(ev.blockers, l.id).toEqual([]);
    }
  });

  it('Jupiter: a Test Flight that fails at launch earns the lesson star and shows the sourced Juno story', () => {
    vi.useFakeTimers();
    localStorage.setItem('mdt.progress', JSON.stringify(Object.fromEntries(LEVELS.slice(0, -1).map((l) => [l.id, 1]))));
    render(<App />);
    fireEvent.click(levelButton(/^Giant Leap/));
    fireEvent.click(screen.getByRole('button', { name: 'Launch' }));
    expect((screen.getByRole('button', { name: /🚀 Launch/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Test Flight/ }));
    for (let t = 0; t < TEST_FLIGHT_MS; t += 250) act(() => vi.advanceTimersByTime(250));
    expect(screen.getByText(/would fail during launch/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fix my craft' }));
    expect(screen.getByText(/Lesson learned/)).toBeTruthy();
    expect(screen.getByText(/gravity assist/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Source of Juno/ })).toBeTruthy();
    expect(loadProgress().jupiter).toBe(1);
  });
});

describe('Level result banner', () => {
  const moon1 = LEVELS[0]!;
  it('with a star: Next level opens the next one', () => {
    const onPlay = vi.fn();
    render(<LevelBanner level={moon1} stars={2} onPlay={onPlay} onMap={() => undefined} onRetry={() => undefined} />);
    expect(screen.getByText('Level complete!')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Next: Heavy Lifting/ }));
    expect(onPlay).toHaveBeenCalledWith(LEVELS[1]);
  });
  it('with no star: try again, and no way forward yet', () => {
    render(<LevelBanner level={moon1} stars={0} onPlay={() => undefined} onMap={() => undefined} onRetry={() => undefined} />);
    expect(screen.getByText(/Try again!/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Next:/ })).toBeNull();
  });
});
