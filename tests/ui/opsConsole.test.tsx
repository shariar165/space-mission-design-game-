// @vitest-environment jsdom
// Operations Console (spec UI rules 16–20): every number on screen is the engine's consoleView / powerPlanPreview /
// dsnOptions output, formatted. MAVEN, seed 2013 (the engine tests' mission), and the no-bad-luck environment.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { simulateMission, evaluateDesign } from '../../src/engine/index';
import { presetDesign } from '../../src/engine/missions';
import {
  advanceOperations,
  consoleView,
  dsnOptions,
  operationsDebrief,
  powerPlanPreview,
  prepareOps,
  startOperations,
  type OpsState,
} from '../../src/engine/ops/index';
import { BookCall } from '../../src/ui/components/ops/BookCall';
import { BlackoutPanel, ExtensionDecision, OpsSummary } from '../../src/ui/components/ops/OpsPanels';
import { PowerDial } from '../../src/ui/components/ops/PowerDial';
import * as f from '../../src/ui/format';
import { BLOCKER, EXTENSION_BLOCKER } from '../../src/ui/opsWords';
import { Debrief } from '../../src/ui/screens/Debrief';
import { OpsConsole } from '../../src/ui/screens/OpsConsole';
import './setup';

const maven = presetDesign('maven');
const env = prepareOps(maven);
const lucky = () => startOperations(maven, { rng: () => 0.999999, env });

function pass(ms: number, step = 50) {
  for (let t = 0; t < ms; t += step) act(() => vi.advanceTimersByTime(step));
}

function openConsole(engineer = false) {
  vi.useFakeTimers();
  const onExit = vi.fn();
  render(<OpsConsole design={maven} seed={2013} engineer={engineer} missionName="Red Atmosphere" onExit={onExit} />);
  pass(100); // the mission is prepared one tick after the loader paints
  return onExit;
}

const nextEvent = () => fireEvent.click(screen.getByRole('button', { name: /Next event/ }));

describe('Operations Console: clock and gauges', () => {
  it('opens on day 0 with the four gauges of consoleView, and the speed buttons run the clock', () => {
    openConsole();
    const v = consoleView(startOperations(maven, { seed: 2013 }));
    expect(document.querySelector('.ops-day-num')!.textContent).toBe(`Day ${f.num(0)}`);
    // Battery: power to spare today = (available − required) / available
    const battery = screen.getByRole('region', { name: 'Battery' });
    expect(battery.textContent).toContain(f.pct(v.gauges.power.fill, 0));
    // Fuel tank in Cadet: propellant left (kg)
    expect(screen.getByRole('region', { name: 'Fuel tank' }).textContent).toContain(f.kg(v.gauges.fuel.propellantLeft_kg));
    expect(screen.getByRole('region', { name: 'Photos waiting' }).textContent).toContain(f.pct(v.gauges.recorder.fill, 0));
    expect(screen.getByRole('region', { name: 'Ops budget' }).textContent).toContain(f.num(v.gauges.budget.spareCoins));
    // Paused at the start; 100× = 100 mission days a real minute → 3 s ≈ 5 days
    expect(screen.getByRole('button', { name: 'Pause' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '100× speed' }));
    expect(screen.getByRole('button', { name: '100× speed' }).getAttribute('aria-pressed')).toBe('true');
    pass(3000, 250);
    const day = Number(/Day\s*([\d,]+)/.exec(document.querySelector('.ops-day-num')!.textContent!)![1]!.replace(',', ''));
    expect(day).toBeGreaterThanOrEqual(3);
    expect(day).toBeLessThanOrEqual(6);
  });
});

describe('Operations Console: hazard alert', () => {
  it('auto-pauses on the first hazard and lists the engine’s options, with blockers and the real-history badge', () => {
    openConsole();
    for (let i = 0; i < 20 && !screen.queryByRole('alertdialog'); i++) act(() => nextEvent());
    const dialog = screen.getByRole('alertdialog');
    // the same moment the engine stops at by itself
    const at = advanceOperations(startOperations(maven, { seed: 2013 }));
    const a = consoleView(at).alert!;
    expect(within(dialog).getByRole('heading').textContent).toBe(a.title);
    expect(within(dialog).getByText('TO VERIFY')).toBeTruthy();
    const radios = within(dialog).getAllByRole('radio');
    expect(radios.map((r) => r.querySelector('.ops-option-name')!.textContent)).toEqual(a.options.map((o) => o.label));
    a.options.forEach((o, i) => {
      expect(radios[i]!.getAttribute('aria-disabled')).toBe(String(!o.affordable));
      for (const b of o.blockedBy) expect(radios[i]!.textContent).toContain(BLOCKER[b]);
    });
    // time is locked while the decision waits
    expect(screen.getByRole('button', { name: '100× speed' }).hasAttribute('disabled')).toBe(true);
    expect(within(dialog).getByText(f.lightTime(a.oneWay_s))).toBeTruthy();
  });

  it('Send: the command crosses space (live countdown), arrives, and the result card resumes the mission', () => {
    openConsole();
    for (let i = 0; i < 20 && !screen.queryByRole('alertdialog'); i++) act(() => nextEvent());
    const dialog = screen.getByRole('alertdialog');
    const safest = within(dialog).getAllByRole('radio').find((r) => r.getAttribute('aria-checked') === 'true')!;
    const label = safest.querySelector('.ops-option-name')!.textContent!;
    fireEvent.click(within(dialog).getByRole('button', { name: /Send command/ }));
    expect(screen.getByText('COMMAND ON ITS WAY')).toBeTruthy();
    expect(screen.getByRole('heading', { name: label })).toBeTruthy();
    const first = document.querySelector('.ops-countdown')!.textContent!;
    pass(1000, 250);
    expect(document.querySelector('.ops-countdown')!.textContent).not.toBe(first); // it counts down
    for (let i = 0; i < 80 && !screen.queryByRole('button', { name: 'Resume mission' }); i++) pass(250, 250);
    expect(screen.getByText('COMMAND RECEIVED')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Resume mission' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    // the response is in the queue as carried out
    fireEvent.click(screen.getByRole('button', { name: /Command queue/ }));
    const queue = screen.getByRole('region', { name: 'Command queue' });
    expect(within(queue).getByText(label)).toBeTruthy();
    expect(within(queue).getByText('CARRIED OUT')).toBeTruthy();
  });
});

describe('Operations Console: conjunction, calls home and the power plan', () => {
  const w = env.conjunctions[0]!;

  it('a blackout shows the day of the window and the engine’s retry day; the power plan cannot be sent', () => {
    const s = advanceOperations(lucky(), { until: w.startDay + 3.5 });
    const v = consoleView(s);
    const onSkip = vi.fn();
    render(<BlackoutPanel view={v} engineer={false} onSkip={onSkip} />);
    expect(screen.getByText(`RADIO BLACKOUT · DAY ${f.num(v.blackout.dayOf!)} OF ${f.num(v.blackout.total!)}`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `Skip ahead to day ${f.num(v.blackout.retryAfterDay!)}` }));
    expect(onSkip).toHaveBeenCalledWith(w.endDay + 1);
    render(<PowerDial state={s} engineer={false} destName="Mars" blocked onSend={() => undefined} onClose={() => undefined} />);
    expect((screen.getByRole('button', { name: /No contact/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('booking a call inside the lead time is refused with the first free day; a valid day books the chosen dish', () => {
    const s = advanceOperations(lucky(), { until: env.arrivalDay + 10 });
    const day = Math.floor(s.t);
    const onBook = vi.fn();
    const { unmount } = render(<BookCall state={s} day={day + 2} engineer={false} onBook={onBook} onClose={() => undefined} />);
    const refused = dsnOptions(s, day + 2).refused!;
    expect(screen.getByText(`Too soon: book from day ${f.num(refused.retryAfterDay!)}.`)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Book the big dish/ }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    render(<BookCall state={s} engineer={true} onBook={onBook} onClose={() => undefined} />);
    const o = dsnOptions(s);
    const big = o.options.find((x) => x.dish === 70)!;
    expect(screen.getByText(f.money(big.extraCost_M, 3))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Book the big dish/ }));
    expect(onBook).toHaveBeenCalledWith(o.day, 70, big.hours);
  });

  it('the power dial reads powerPlanPreview: today’s margin and the battery’s lowest charge in eclipse', () => {
    const season = env.eclipseSeasons.find((e) => e.startDay > env.arrivalDay)!;
    const s: OpsState = advanceOperations(lucky(), { until: season.startDay - 3 });
    const onSend = vi.fn();
    render(<PowerDial state={s} engineer={true} destName="Mars" blocked={false} onSend={onSend} onClose={() => undefined} />);
    const p = powerPlanPreview(s, s.plan);
    expect(screen.getByText(f.pct(p.eclipse!.lowestCharge, 0))).toBeTruthy();
    expect(document.querySelector('.ops-dial-msg')!.textContent).toContain(`margin today ${f.signedPct(p.today.margin, 1)}`);
    // science off: the engine's margin for that plan
    fireEvent.change(screen.getByRole('slider', { name: 'Science share' }), { target: { value: '0' } });
    const off = powerPlanPreview(s, { ...s.plan, instruments: Object.fromEntries(Object.keys(s.plan.instruments).map((k) => [k, 0])) });
    expect(document.querySelector('.ops-dial-msg')!.textContent).toContain(`margin today ${f.signedPct(off.today.margin, 1)}`);
    fireEvent.click(screen.getByRole('button', { name: /Send plan/ }));
    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ heaters: s.plan.heaters, radio: true }));
  });
});

describe('Operations Console: extension and debrief', () => {
  it('the extension cards are the engine’s options; Retire ends the mission and the summary keeps the prime stars', () => {
    const s = advanceOperations(lucky(), { until: env.primeEndDay + 2 });
    const opts = consoleView(s).extension!.options;
    const onChoose = vi.fn();
    render(<ExtensionDecision options={opts} engineer={false} destName="Mars" scienceDays={s.scienceDaysAchieved} onChoose={onChoose} />);
    for (const o of opts.filter((x) => x.years > 0)) expect(screen.getByText(f.gbit(o.expectedData_Gbit))).toBeTruthy();
    for (const o of opts) for (const b of o.blockedBy) expect(screen.getByText(EXTENSION_BLOCKER[b], { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retire the craft' }));
    expect(onChoose).toHaveBeenCalledWith('end');
    const d = operationsDebrief(s);
    render(<OpsSummary debrief={d} destName="Mars" onExit={() => undefined} onRestart={() => undefined} />);
    expect(screen.getByLabelText(`${d.stars} of 3 stars`)).toBeTruthy();
    expect(screen.getByText(`${f.num(d.score)} PTS · PRIME MISSION`)).toBeTruthy();
  });
});

describe('Operations Console: Engineer layer and entry', () => {
  it('Engineer mode shows the mission elapsed time, each gauge’s equation and the ⓘ sources', () => {
    openConsole(true);
    const v = consoleView(startOperations(maven, { seed: 2013 }));
    expect(document.querySelector('.ops-met')!.textContent).toContain(`MET ${f.met(0)}`);
    const eqs = [...document.querySelectorAll('.ops-eq')].map((e) => e.textContent);
    expect(eqs).toContain(v.gauges.power.equation);
    expect(eqs).toContain(v.gauges.fuel.equation);
    expect(screen.getAllByRole('button', { name: /^Source of / }).length).toBeGreaterThan(8);
  });

  it('the Debrief offers “Run mission operations” when the design can fly it', () => {
    const ev = evaluateDesign(maven);
    const sim = simulateMission(maven, { seed: 2013 });
    const onOps = vi.fn();
    render(<Debrief design={maven} ev={ev} sim={sim} missionName="Red Atmosphere" engineer={false} seed={2013} seedFromUrl={false} onRetry={() => undefined} onEngineer={() => undefined} onOps={onOps} />);
    fireEvent.click(screen.getByRole('button', { name: /Run mission operations/ }));
    expect(onOps).toHaveBeenCalled();
  });
});
