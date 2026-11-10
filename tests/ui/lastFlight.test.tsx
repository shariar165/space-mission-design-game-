// @vitest-environment jsdom
// Change one thing and fly again (spec UI rule 60): FLY AGAIN returns to Pack with the packing, objective, rocket and
// orbit kept; MISSION LIMITS shows the last flight's stars and science and each bar's change since; the report names a
// part that would have helped (packHint). Every number is the engine's.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/ui/App';
import * as f from '../../src/ui/format';
import { FINISH_CONFIRM, LAST_WORDS, LIMIT_WORDS, NAV, REPORT_WORDS } from '../../src/ui/sdWords';
import { pickObjective } from './setup';

function pass(ms: number, step = 50) {
  for (let t = 0; t < ms; t += step) act(() => vi.advanceTimersByTime(step));
}

/** Red Planet: pick the objective, pack the shield, fly, let the robot finish, open the report. */
function flyOnce() {
  vi.useFakeTimers();
  localStorage.setItem('sd.seen', JSON.stringify(['name', 'coach', 'brief:mars', 'launch:mars']));
  localStorage.setItem('mdt.progress', JSON.stringify({ 'moon-1': 1, 'moon-2': 1, 'moon-3': 1 }));
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'CHOOSE A MISSION ▸' }));
  fireEvent.click(screen.getByRole('button', { name: /^Red Planet/ }));
  pass(100);
  pickObjective();
  fireEvent.click(screen.getByRole('button', { name: 'Pack Radiation shield' }));
  fireEvent.click(screen.getByRole('switch', { name: 'Arm' }));
  fireEvent.click(screen.getByRole('button', { name: 'LAUNCH' }));
  pass(100);
  fireEvent.click(screen.getByRole('button', { name: NAV.finish }));
  fireEvent.click(within(screen.getByRole('dialog', { name: FINISH_CONFIRM.title })).getByRole('button', { name: FINISH_CONFIRM.yes }));
  fireEvent.click(screen.getByRole('button', { name: 'SEE MISSION REPORT ▸' }));
}

const limits = () => screen.getByRole('region', { name: LIMIT_WORDS.label });

describe('change one thing and fly again', () => {
  it('a first flight has no LAST FLIGHT strip', () => {
    vi.useFakeTimers();
    localStorage.setItem('sd.seen', JSON.stringify(['name', 'brief:mars']));
    localStorage.setItem('mdt.progress', JSON.stringify({ 'moon-1': 1, 'moon-2': 1, 'moon-3': 1 }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'CHOOSE A MISSION ▸' }));
    fireEvent.click(screen.getByRole('button', { name: /^Red Planet/ }));
    pass(100);
    expect(within(limits()).queryByRole('group', { name: LAST_WORDS.label })).toBeNull();
  });

  it('FLY AGAIN: Pack with the packing and objective kept, the last flight over the bars, and the change after one edit', () => {
    flyOnce();
    fireEvent.click(screen.getByRole('button', { name: REPORT_WORDS.flyAgain }));
    pass(100);
    // the packing is kept (the shield is still in the nose) and the objective is not asked again
    expect(screen.getByRole('button', { name: 'Unpack Radiation shield' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Mission briefing' })).toBeNull();
    const strip = within(limits()).getByRole('group', { name: LAST_WORDS.label });
    expect(within(strip).getByText(LAST_WORDS.title)).toBeTruthy();
    expect(within(strip).getByRole('img', { name: /of 3 stars$/ })).toBeTruthy();
    expect(within(strip).getByText(/OF THE SCIENCE HOME$/)).toBeTruthy();
    // the same craft as last time: no change on any bar
    expect(within(limits()).queryByText(/VS LAST/)).toBeNull();
    // change one thing: the camera adds 25 $M of development
    fireEvent.click(screen.getByRole('button', { name: 'Pack Camera' }));
    expect(within(limits()).getByText(LAST_WORDS.change(f.signedMoney(25)), { exact: false })).toBeTruthy();
  });
});
