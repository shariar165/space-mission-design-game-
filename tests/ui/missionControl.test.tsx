// @vitest-environment jsdom
// Light-delay Mission Control: standing orders before launch, the news pulse, and a late command.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildCadetDesign, defaultChoices } from '../../src/engine/cadet';
import { CRISIS_CARDS } from '../../src/engine/crisis';
import { countdown, signalDelay } from '../../src/engine/flightMap';
import { crisisOrders, evaluateDesign, previewCrisis, simulateMission, standingOrderPolicy } from '../../src/engine/index';
import { App } from '../../src/ui/App';
import { MissionControl, PULSE_MS } from '../../src/ui/components/MissionControl';
import { OrdersPanel } from '../../src/ui/components/OrdersPanel';
import { Flight, FLIGHT_MS } from '../../src/ui/screens/Flight';
import * as f from '../../src/ui/format';
import { starterDesign, today } from '../../src/ui/starters';
import { openMarsLevel } from './setup';

const base = starterDesign('mars', today());
const design = buildCadetDesign(base, defaultChoices(base));
const ev = evaluateDesign(design);

function pass(ms: number, step = 100) {
  for (let t = 0; t < ms; t += step) act(() => vi.advanceTimersByTime(step));
}

describe('Standing orders panel', () => {
  it('shows every crisis this mission can meet; the safer option is pre-selected', () => {
    const list = crisisOrders(design);
    render(<OrdersPanel orders={list} chosen={{}} onChoose={() => undefined} />);
    for (const o of list) {
      const group = screen.getByRole('group', { name: `${o.card.title} orders` });
      const on = within(group).getAllByRole('button', { pressed: true });
      expect(on).toHaveLength(1);
      expect(on[0]!.textContent).toContain(o.card.options.find((x) => x.id === o.defaultOptionId)!.label);
    }
  });

  it('a fuel option shows the propellant it burns (engine rocket equation)', () => {
    const list = crisisOrders(design);
    const nav = list.find((o) => o.card.id === 'unit-mismatch')!;
    render(<OrdersPanel orders={list} chosen={{}} onChoose={() => undefined} />);
    const btn = screen.getByRole('button', { name: /extra navigation check/ });
    expect(btn.textContent).toContain(f.kg(nav.fuel_kg['nav-check']!));
  });

  it('choosing an option reports it', () => {
    const onChoose = vi.fn();
    render(<OrdersPanel orders={crisisOrders(design)} chosen={{}} onChoose={onChoose} />);
    fireEvent.click(screen.getByRole('button', { name: /Trust the plan/ }));
    expect(onChoose).toHaveBeenCalledWith('unit-mismatch', 'trust-plan');
  });

  it('in the game, Orders sits between Rocket and Launch', () => {
    openMarsLevel(() => render(<App />), fireEvent.click, screen.getByRole);
    const names = within(screen.getByRole('navigation', { name: 'Build steps' }))
      .getAllByRole('button')
      .map((b) => b.textContent!.replace(/[^A-Za-z]/g, ''));
    expect(names.slice(-3)).toEqual(['Rocket', 'Orders', 'Launch']);
  });
});

describe('Mission Control', () => {
  const card = CRISIS_CARDS.find((c) => c.id === 'unit-mismatch')!;
  const day = 194;
  const signal = signalDelay(design, day, ev);

  it('the news pulse counts down the real light time, then shows the standing order the craft followed', () => {
    vi.useFakeTimers();
    render(
      <MissionControl card={card} day={day} phase="cruise" destName="Mars" signal={signal} order={card.options[0]!} others={[card.options[1]!]} onContinue={() => undefined} />,
    );
    expect(screen.getByText(/News of the crisis reaches Earth in/).textContent).toContain(f.clock(signal.oneWay_s));
    pass(PULSE_MS / 2);
    expect(screen.getByText(/News of the crisis reaches Earth in/).textContent).toContain(f.clock(countdown(signal.oneWay_s, 0.5)));
    pass(PULSE_MS);
    expect(screen.getByText(/did not wait/)).toBeTruthy();
    expect(screen.getByText(new RegExp(card.options[0]!.label))).toBeTruthy();
  });

  it('a new command arrives too late: one round trip after the crisis began', () => {
    vi.useFakeTimers();
    const onContinue = vi.fn();
    render(
      <MissionControl card={card} day={day} phase="cruise" destName="Mars" signal={signal} order={card.options[0]!} others={[card.options[1]!]} onContinue={onContinue} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send a new command' }));
    fireEvent.click(screen.getByRole('button', { name: /Trust the plan/ }));
    expect(screen.getByText(/Your command arrives in/)).toBeTruthy();
    pass(PULSE_MS + 200);
    expect(screen.getByText(/Too late/)).toBeTruthy();
    expect(screen.getByText(/after the crisis began/).textContent).toContain(f.clock(signal.roundTrip_s));
    fireEvent.click(screen.getByRole('button', { name: /Continue flight/ }));
    expect(onContinue).toHaveBeenCalled();
  });
});

describe('Flight screen', () => {
  it('pauses on the crisis day for Mission Control, then flies on to the result', () => {
    vi.useFakeTimers();
    const seed = 8;
    const p = previewCrisis(design, seed)!;
    const sim = simulateMission(design, { seed, crisisPolicy: standingOrderPolicy({}) });
    expect(sim.crisis!.reached).toBe(true);
    const onDone = vi.fn();
    render(<Flight design={design} ev={ev} sim={sim} crisis={{ card: p.card, options: p.options }} missionName="Test" onDone={onDone} />);
    pass(FLIGHT_MS * 2, 50);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(p.card.title)).toBeTruthy();
    expect(within(dialog).getByText(new RegExp(`Day ${f.num(sim.crisis!.day)}`))).toBeTruthy();
    // The flight waits on the crisis day while the news pulse finishes on its own.
    expect(within(dialog).getByText(/did not wait/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Continue flight/ }));
    pass(FLIGHT_MS * 2, 50);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /See debrief/ }));
    expect(onDone).toHaveBeenCalled();
  });
});
