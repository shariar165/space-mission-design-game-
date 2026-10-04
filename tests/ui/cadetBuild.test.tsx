// @vitest-environment jsdom
// Cadet Build Bay: one decision per screen, gauges that reveal the real numbers, and the Test Flight.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildCadetDesign, cadetOptions, defaultChoices, testFlight } from '../../src/engine/cadet';
import { evaluateDesign } from '../../src/engine/index';
import { App } from '../../src/ui/App';
import { TestFlight, TEST_FLIGHT_MS } from '../../src/ui/components/TestFlight';
import * as f from '../../src/ui/format';
import { starterDesign, today } from '../../src/ui/starters';
import './setup';

describe('Cadet guided build', () => {
  it('starts on step 1 of 5 with 2–3 cards and moves one decision at a time', () => {
    render(<App />);
    expect(screen.getByText(/Step 1 of 5 — Science/)).toBeTruthy();
    expect(screen.getAllByRole('button', { pressed: true }).length).toBeGreaterThan(0);
    const cards = within(screen.getByRole('group', { name: 'Science choices' })).getAllByRole('button');
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(cards.length).toBeLessThanOrEqual(3);
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByText(/Step 2 of 5 — Power/)).toBeTruthy();
    expect(screen.queryByText(/Step 1 of 5/)).toBeNull();
  });

  it('a card shows the engine chips; choosing the heavy RTG card tips the scale red', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    const base = starterDesign('mars', today());
    const rtg = cadetOptions(base, defaultChoices(base), 'power').find((o) => o.id === 'rtg')!;
    const card = screen.getByRole('button', { name: /Nuclear RTGs/ });
    expect(card.textContent).toContain(f.kg(rtg.chips.mass_kg));
    expect(card.textContent).toContain('too heavy');
    fireEvent.click(card);
    expect(screen.getByRole('button', { name: /Nuclear RTGs/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Weight/ }).textContent).toContain('Too heavy');
  });

  it('tapping a gauge reveals the real number and its ⓘ sources', () => {
    render(<App />);
    const base = starterDesign('mars', today());
    const ev = evaluateDesign(buildCadetDesign(base, defaultChoices(base)));
    fireEvent.click(screen.getByRole('button', { name: /Weight/ }));
    const panel = screen.getByRole('region', { name: /Weight: the real numbers/ });
    expect(panel.textContent).toContain(f.kg(ev.meters.mass.limit));
    expect(within(panel).getAllByRole('button', { name: /^Source of/ }).length).toBeGreaterThan(0);
  });

  it('the review screen locks Launch while the craft is too heavy', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    fireEvent.click(screen.getByRole('button', { name: /Nuclear RTGs/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Launch' }));
    expect(screen.getByText(/Check your craft, then launch/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /🚀 Launch/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

/** Let fake time pass in small slices, so each step's effect can schedule the next one. */
function pass(ms: number) {
  for (let t = 0; t < ms; t += 250) act(() => vi.advanceTimersByTime(250));
}

describe('Test Flight', () => {
  const base = starterDesign('mars', today());
  const good = buildCadetDesign(base, defaultChoices(base));

  it('an overweight craft stops at launch with one plain sentence', () => {
    vi.useFakeTimers();
    render(<TestFlight result={testFlight({ ...good, propellant_kg: 20000 })} destName="Mars" onClose={() => undefined} />);
    expect(screen.getByText(/Flying the plan/)).toBeTruthy();
    pass(TEST_FLIGHT_MS);
    expect(screen.getByText(/would fail during launch/)).toBeTruthy();
    expect(screen.getByText(/Too heavy: the rocket cannot lift/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fix my craft' })).toBeTruthy();
  });

  it('a balanced craft flies every checkpoint in about ten seconds', () => {
    vi.useFakeTimers();
    render(<TestFlight result={testFlight(good)} destName="Mars" onClose={() => undefined} />);
    pass(TEST_FLIGHT_MS / 2);
    expect(screen.queryByText(/All clear/)).toBeNull();
    pass(TEST_FLIGHT_MS);
    expect(screen.getByText(/All clear/)).toBeTruthy();
  });

  it('Skip jumps to the result', () => {
    render(<TestFlight result={testFlight({ ...good, propellant_kg: 100 })} destName="Mars" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByText(/would fail during arrival/)).toBeTruthy();
    expect(screen.getByText(/flies past Mars/)).toBeTruthy();
  });
});
