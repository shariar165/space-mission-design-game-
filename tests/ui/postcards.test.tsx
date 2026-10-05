// @vitest-environment jsdom
// Postcards from space: the album (Home → POSTCARDS), the flight's new cards and the report's strip. Which cards are
// open, and the counts, come from the engine (postcards.ts).
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { presetDesign } from '../../src/engine/missions';
import { runOperations } from '../../src/engine/ops/index';
import { POSTCARDS, postcardsEarned } from '../../src/engine/postcards';
import { App } from '../../src/ui/App';
import * as f from '../../src/ui/format';
import { FlyAndSurvive } from '../../src/ui/screens/FlyAndSurvive';
import { MissionReport } from '../../src/ui/screens/MissionReport';
import { Postcards } from '../../src/ui/screens/Postcards';
import { POSTCARD_WORDS } from '../../src/ui/sdWords';
import './setup';

const maven = presetDesign('maven');

function pass(ms: number, step = 50) {
  for (let t = 0; t < ms; t += step) act(() => vi.advanceTimersByTime(step));
}

describe('the album', () => {
  it('open cards show their picture; locked ones say how to earn them; a card opens full size with its credit', () => {
    render(<Postcards earned={['mars-globe']} onHome={vi.fn()} />);
    expect(screen.getByText(`${f.num(1)} / ${f.num(POSTCARDS.length)}`)).toBeTruthy();
    const grid = screen.getByRole('list', { name: POSTCARD_WORDS.title });
    expect(within(grid).getAllByRole('listitem').length).toBe(POSTCARDS.length);
    expect(screen.getByLabelText(`${POSTCARD_WORDS.locked}: ${POSTCARD_WORDS.hint('Mars', 0.5)}`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'The whole red planet (Mars)' }));
    const card = screen.getByRole('dialog', { name: 'Postcard: The whole red planet' });
    expect(card.textContent).toContain(POSTCARD_WORDS.credit('NASA/JPL/USGS'));
    expect(card.querySelector('img')!.getAttribute('src')).toBe('/postcards/mars-globe.jpg');
    expect(card.textContent).toContain('TO VERIFY');
  });

  it('Home shows the count and opens the album; earned cards are remembered', () => {
    localStorage.setItem('sd.postcards', JSON.stringify({ earned: ['moon-earthrise', 'moon-tycho'] }));
    render(<App />);
    const key = screen.getByRole('button', { name: new RegExp(`^${POSTCARD_WORDS.menu}: .*\\(${f.num(2)} OF ${f.num(POSTCARDS.length)}\\)`) });
    fireEvent.click(key);
    expect(screen.getByText(`${f.num(2)} / ${f.num(POSTCARDS.length)}`)).toBeTruthy();
  });
});

describe('postcards from a flight', () => {
  it('FINISH MISSION: the flight reports every card it earned', () => {
    vi.useFakeTimers();
    const onPostcards = vi.fn();
    render(<FlyAndSurvive design={maven} seed={2013} mode="cadet" onMode={vi.fn()} missionName="Orbiter-1" onHome={vi.fn()} onDone={vi.fn()} onPostcards={onPostcards} />);
    pass(100);
    fireEvent.click(screen.getByRole('button', { name: /FINISH MISSION/ }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'FINISH THE MISSION?' })).getByRole('button', { name: /FINISH MISSION/ }));
    pass(500);
    const want = postcardsEarned(runOperations(maven, { seed: 2013, policy: 'default' }).state);
    expect(want.length).toBeGreaterThan(0);
    expect(onPostcards).toHaveBeenLastCalledWith(want);
  });

  it('the report shows the postcards this flight earned, and opens one', () => {
    const s = runOperations(maven, { rng: () => 0.999999 }).state;
    const won = postcardsEarned(s);
    render(<MissionReport state={s} design={maven} mode="cadet" onMode={vi.fn()} missionName="Orbiter-1" onFlyAgain={vi.fn()} onHome={vi.fn()} homeLabel="HOME" />);
    const strip = screen.getByRole('region', { name: POSTCARD_WORDS.report });
    expect(within(strip).getAllByRole('button').length).toBe(won.length);
    const first = POSTCARDS.find((c) => c.id === won[0])!;
    fireEvent.click(within(strip).getByRole('button', { name: first.title }));
    expect(screen.getByRole('dialog', { name: `Postcard: ${first.title}` })).toBeTruthy();
  });
});
