// @vitest-environment jsdom
// ?play=<level id> (a judge's or a teacher's link): opens that level's Pack straight away, whatever is unlocked, and
// leaves saved progress alone. Unknown ids are ignored.
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/ui/App';
import { loadProgress } from '../../src/ui/levels';
import { OBJECTIVE_PICK_WORDS } from '../../src/ui/sdWords';
import './setup';

function pass(ms: number, step = 50) {
  for (let t = 0; t < ms; t += step) act(() => vi.advanceTimersByTime(step));
}

afterEach(() => window.history.replaceState({}, '', '/'));

describe('?play= link', () => {
  it('opens Red Planet on a fresh browser (nothing unlocked): its briefing asks for the objective', () => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/?play=mars');
    render(<App />);
    pass(100);
    expect(screen.getByRole('dialog', { name: 'Mission briefing' })).toBeTruthy();
    expect(screen.getByText(OBJECTIVE_PICK_WORDS.heading)).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Mission limits' })).toBeTruthy();
    // nothing was unlocked or starred by the link
    expect(loadProgress()).toEqual({});
  });

  it('an unknown level id is ignored: Home as usual', () => {
    window.history.replaceState({}, '', '/?play=pluto');
    render(<App />);
    expect(screen.queryByRole('dialog', { name: 'Mission briefing' })).toBeNull();
    expect(screen.getByRole('button', { name: 'CHOOSE A MISSION ▸' })).toBeTruthy();
  });
});
