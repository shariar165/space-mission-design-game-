// @vitest-environment jsdom
// Rescue History: inspect the Mars Climate Orbiter file, rule out real-but-wrong clues, find the units bug.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { rescueCase, rescueConsequence } from '../../src/engine/rescue';
import { App } from '../../src/ui/App';
import * as f from '../../src/ui/format';
import { loadProgress } from '../../src/ui/levels';
import { RescueCaseView } from '../../src/ui/screens/Rescue';
import './setup';

const accuse = (title: string) => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(title) }));
  fireEvent.click(screen.getByRole('button', { name: 'This is the bug!' }));
};

describe('Rescue History: Mars Climate Orbiter', () => {
  const c = rescueCase('mco');

  it('the mission file shows the published facts, each with its source', () => {
    render(<RescueCaseView id="mco" onSolved={() => undefined} onBack={() => undefined} />);
    const file = screen.getByRole('region', { name: 'Mission file' });
    expect(file.textContent).toContain(c.facts.launchVehicle.value);
    expect(file.textContent).toContain(f.kg(c.facts.launchMass_kg.value));
    expect(file.textContent).toContain(f.clock(c.facts.lightTimeAtArrival_s.value));
    expect(within(file).getAllByRole('button', { name: /^Source of/ }).length).toBe(9);
  });

  it('a real-but-wrong clue is ruled out with its verdict; the units clue solves it with 2 stars', () => {
    const onSolved = vi.fn();
    render(<RescueCaseView id="mco" onSolved={onSolved} onBack={() => undefined} />);
    accuse('Busy navigators');
    expect(screen.getByText(c.clues.find((x) => x.id === 'staffing')!.verdict)).toBeTruthy();
    expect(onSolved).not.toHaveBeenCalled();
    accuse('Thruster-firing file');
    expect(onSolved).toHaveBeenCalledWith(2);
    expect(screen.getByText(/Bug found/)).toBeTruthy();
    const k = rescueConsequence('mco');
    expect(screen.getByText(/drifted/).textContent).toContain(`${f.num(k.missedBy_km)} km`);
    expect(screen.getByRole('img', { name: /Planned 226 km, survivable 80 km, actual 57 km/ })).toBeTruthy();
  });

  it('first try: 3 stars, saved to progress, opened from Home', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /RESCUE HISTORY/ }));
    fireEvent.click(screen.getByRole('button', { name: /Mars Climate Orbiter/ }));
    accuse('Thruster-firing file');
    expect(loadProgress()['rescue-mco']).toBe(3);
    fireEvent.click(screen.getByRole('button', { name: 'Back to Rescue History' }));
    expect(screen.getByText('Save a mission that was lost')).toBeTruthy();
  });
});
