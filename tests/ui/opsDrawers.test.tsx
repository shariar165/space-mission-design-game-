// @vitest-environment jsdom
// Fly & Survive drawers (spec UI rules 18–20): power plan, call home, blackout, extension and the end summary.
// Every number is the engine's consoleView / powerPlanPreview / dsnOptions output, formatted. MAVEN, no bad luck.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
import { EXTENSION_BLOCKER } from '../../src/ui/opsWords';
import './setup';

const maven = presetDesign('maven');
const env = prepareOps(maven);
const lucky = () => startOperations(maven, { rng: () => 0.999999, env });

describe('Drawers: conjunction, calls home and the power plan', () => {
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

describe('Drawers: extension and debrief', () => {
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
