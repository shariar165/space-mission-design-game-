// @vitest-environment jsdom
// MISSION REPORT (Signal Delay screen 03): every line is operationsDebrief / ops/report.ts output, formatted.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { presetDesign } from '../../src/engine/missions';
import { operationsDebrief, runOperations } from '../../src/engine/ops/index';
import { reportCompare, reportPanels } from '../../src/engine/ops/report';
import type { Mode } from '../../src/ui/components/sd/ModeLever';
import * as f from '../../src/ui/format';
import { MissionReport, PANEL_STEP_MS } from '../../src/ui/screens/MissionReport';
import { CATEGORY_NAME, panelWords } from '../../src/ui/sdWords';
import './setup';

const maven = presetDesign('maven');
const flown = runOperations(maven, { seed: 2013, policy: 'safe', extension: 'end' }).state;

function open(mode: Mode = 'cadet') {
  vi.useFakeTimers();
  const onFlyAgain = vi.fn();
  const onPlay = vi.fn();
  render(
    <MissionReport
      state={flown}
      design={maven}
      mode={mode}
      onMode={vi.fn()}
      missionName="Orbiter-1"
      next={{ title: 'Cloud Diver', onPlay }}
      onFlyAgain={onFlyAgain}
      onHome={vi.fn()}
      homeLabel="MISSION MAP"
    />,
  );
  return { onFlyAgain, onPlay };
}

describe('Mission Report', () => {
  it('stars, stamp and the four panels come from the engine; the comic prints one panel at a time', () => {
    open();
    const d = operationsDebrief(flown);
    expect(screen.getByLabelText(`${f.num(d.stars)} of 3 stars`)).toBeTruthy();
    expect(document.querySelector('.rp-stamp')!.textContent).toBe('MISSIONCOMPLETE');
    const panels = reportPanels(flown);
    const figs = screen.getAllByRole('figure');
    expect(figs.length).toBe(panels.length);
    const ctx = { dest: 'Mars', rocket: 'Atlas V 401', label: () => '', title: () => '', autopilot: false, sent_Gbit: d.downlinked_Gbit };
    panels.forEach((p, i) => expect(within(figs[i]!).getByText(panelWords(p, ctx).head)).toBeTruthy());
    act(() => vi.advanceTimersByTime(100));
    expect(figs[0]!.className).toContain('on');
    expect(figs[3]!.className).not.toContain('on');
    for (let t = 0; t < PANEL_STEP_MS * 4; t += 40) act(() => vi.advanceTimersByTime(40)); // each tick schedules the next
    expect(figs[3]!.className).toContain('on');
  }, 30_000);

  it('you vs the real one: launch dates and planned science from the preset', () => {
    open();
    const c = reportCompare(maven, flown.env.ev)!;
    const t = within(screen.getByRole('table', { name: 'You vs the real mission' }));
    expect(t.getAllByText(f.isoDate(c.launch.them.value).toUpperCase()).length).toBeGreaterThan(0);
    expect(t.getAllByText(f.days(c.scienceDays.them!.value).toUpperCase()).length).toBeGreaterThan(0);
  });

  it('FLY AGAIN and NEXT go back to the game', () => {
    const { onFlyAgain, onPlay } = open();
    fireEvent.click(screen.getByRole('button', { name: 'FLY AGAIN' }));
    fireEvent.click(screen.getByRole('button', { name: 'NEXT: CLOUD DIVER' }));
    expect(onFlyAgain).toHaveBeenCalled();
    expect(onPlay).toHaveBeenCalled();
  });

  it('Engineer details: the score breakdown Σ wᵢ sᵢ with the next-star row highlighted, and ⓘ on the comparison', () => {
    open('engineer');
    const d = operationsDebrief(flown);
    const table = screen.getByRole('table', { name: 'Score breakdown' });
    for (const b of d.breakdown) expect(within(table).getByText(CATEGORY_NAME[b.category])).toBeTruthy();
    if (d.hintCategory) expect(within(table).getByText(CATEGORY_NAME[d.hintCategory]).closest('[role=row]')!.className).toContain('hint');
    expect(screen.getByText(`NEXT STAR · ${d.hint}`)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Source of MAVEN/ }).length).toBeGreaterThan(2);
  });
});
