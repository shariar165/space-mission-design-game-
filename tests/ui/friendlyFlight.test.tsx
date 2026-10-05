// @vitest-environment jsdom
// A friendlier game: every flight reaches the report (FINISH MISSION, time that keeps running after each card, a
// stall guard), mission briefings and the how-to-fly coach, the launch checklist, and ◂ BACK on every step.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { presetDesign } from '../../src/engine/missions';
import { missionProgress, startOperations } from '../../src/engine/ops/index';
import { App } from '../../src/ui/App';
import * as f from '../../src/ui/format';
import { FlyAndSurvive } from '../../src/ui/screens/FlyAndSurvive';
import { BRIEFING, COACH, endsInWords, FINISH_CONFIRM, LAUNCH_CHECKS, LEAVE_CONFIRM, NAV } from '../../src/ui/sdWords';
import './setup';

const maven = presetDesign('maven');

function pass(ms: number, step = 50) {
  for (let t = 0; t < ms; t += step) act(() => vi.advanceTimersByTime(step));
}

function fly(extra: Partial<Parameters<typeof FlyAndSurvive>[0]> = {}) {
  vi.useFakeTimers();
  const onDone = vi.fn();
  const onBack = vi.fn();
  render(
    <FlyAndSurvive design={maven} seed={2013} mode="cadet" onMode={vi.fn()} missionName="Orbiter-1" onHome={vi.fn()} onDone={onDone} onBack={onBack} {...extra} />,
  );
  pass(100); // the mission is prepared one tick after the loader paints
  return { onDone, onBack };
}

describe('Fly & Survive always reaches the report', () => {
  it('FINISH MISSION asks first, then the robot flies the rest and SEE MISSION REPORT ends the flight', () => {
    const { onDone } = fly();
    fireEvent.click(screen.getByRole('button', { name: NAV.finish }));
    const ask = screen.getByRole('dialog', { name: FINISH_CONFIRM.title });
    fireEvent.click(within(ask).getByRole('button', { name: FINISH_CONFIRM.yes }));
    expect(screen.queryByRole('dialog', { name: FINISH_CONFIRM.title })).toBeNull();
    const end = screen.getByRole('dialog', { name: 'Mission over' });
    fireEvent.click(within(end).getByRole('button', { name: 'SEE MISSION REPORT ▸' }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(['complete', 'lost']).toContain(onDone.mock.calls[0]![0].status);
  });

  it('at top speed time keeps running after every card, and the flight ends without pressing play again', () => {
    const { onDone } = fly();
    fireEvent.click(screen.getByRole('button', { name: `${f.num(1000)}× speed` }));
    let presses = 0;
    for (let i = 0; i < 4000 && !screen.queryByRole('dialog', { name: 'Mission over' }); i++) {
      const danger = screen.queryByRole('dialog', { name: /DANGER CARD|PLAN AHEAD/ });
      const decide = danger && within(danger).queryByRole('button', { name: /LET THE ROBOT DECIDE/ });
      const pick = danger && [...danger.querySelectorAll<HTMLButtonElement>('.dc-choice')].find((b) => !b.disabled);
      const go = screen.queryByRole('button', { name: 'CONTINUE ▸' }) ?? screen.queryByRole('button', { name: 'Retire the craft' }) ?? decide ?? pick;
      if (go) act(() => fireEvent.click(go));
      else pass(250, 250);
      // the speed key is never pressed again: the clock was only held by the card
      if (screen.getByRole('button', { name: 'Pause' }).getAttribute('aria-pressed') === 'true') presses++;
    }
    expect(presses).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'SEE MISSION REPORT ▸' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  }, 120_000);

  it('shows the mission progress line from the engine, and nudges the player to press play', () => {
    fly();
    const p = missionProgress(startOperations(maven, { seed: 2013 }));
    expect(screen.getByRole('progressbar', { name: 'Mission progress' }).getAttribute('aria-valuenow')).toBe('0');
    // paused at launch: the line says how to start; once time runs it says when the mission ends
    expect(screen.getByText(`▶ PRESS ${f.num(100)}× TO LET TIME RUN`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `${f.num(10)}× speed` }));
    expect(screen.getByText(endsInWords(p.daysLeft))).toBeTruthy();
  });
});

describe('Fly & Survive: Back, help and briefing', () => {
  it('◂ BACK asks before leaving; KEEP FLYING stays, LEAVE FLIGHT goes back', () => {
    const { onBack } = fly();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('dialog', { name: LEAVE_CONFIRM.title })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: LEAVE_CONFIRM.stay }));
    expect(screen.queryByRole('dialog', { name: LEAVE_CONFIRM.title })).toBeNull();
    expect(onBack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: LEAVE_CONFIRM.leave }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('the coach panels open on the first flight, hold the clock, and step through to GOT IT', () => {
    const onCoachSeen = vi.fn();
    fly({ coach: true, onCoachSeen });
    const coach = screen.getByRole('dialog', { name: NAV.help });
    expect(within(coach).getByRole('heading', { name: COACH[0]!.title })).toBeTruthy();
    // held: the speed keys cannot start time behind the panels
    expect(screen.getByRole('button', { name: `${f.num(100)}× speed` }).hasAttribute('disabled')).toBe(true);
    for (let i = 1; i < COACH.length; i++) fireEvent.click(within(coach).getByRole('button', { name: NAV.next }));
    expect(within(coach).getByRole('heading', { name: COACH.at(-1)!.title })).toBeTruthy();
    fireEvent.click(within(coach).getByRole('button', { name: NAV.start }));
    expect(screen.queryByRole('dialog', { name: NAV.help })).toBeNull();
    expect(onCoachSeen).toHaveBeenCalledTimes(1);
    // ? opens it again
    fireEvent.click(screen.getByRole('button', { name: NAV.help }));
    expect(screen.getByRole('dialog', { name: NAV.help })).toBeTruthy();
  });

  it('MISSION INFO shows the briefing', () => {
    fly({ brief: { title: 'Red Planet', briefing: BRIEFING.mars!, concept: 'Light delay' } });
    fireEvent.click(screen.getByRole('button', { name: NAV.info }));
    const b = screen.getByRole('dialog', { name: 'Mission briefing' });
    expect(within(b).getByText(BRIEFING.mars!.job)).toBeTruthy();
    expect(within(b).getByText(/Real NASA mission that flew there: MAVEN/)).toBeTruthy();
  });
});

describe('Pack: briefing and launch checklist', () => {
  it('the briefing opens the first time a level is played, and not the second time', () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Play: mission/ }));
    pass(100);
    const b = screen.getByRole('dialog', { name: 'Mission briefing' });
    expect(within(b).getByText(BRIEFING['moon-1']!.job)).toBeTruthy();
    fireEvent.click(within(b).getByRole('button', { name: NAV.start }));
    expect(screen.queryByRole('dialog', { name: 'Mission briefing' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Back' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: /^Play: mission/ }));
    pass(100);
    expect(screen.queryByRole('dialog', { name: 'Mission briefing' })).toBeNull();
    // MISSION INFO brings it back
    fireEvent.click(screen.getAllByRole('button', { name: NAV.info })[0]!);
    expect(screen.getByRole('dialog', { name: 'Mission briefing' })).toBeTruthy();
  });

  it('the checklist ticks itself off and lights the next thing to do', () => {
    vi.useFakeTimers();
    localStorage.setItem('sd.seen', JSON.stringify(['brief:moon-1']));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Play: mission/ }));
    pass(100);
    const list = screen.getAllByRole('list', { name: 'Launch checklist' })[0]!;
    const item = (t: string) => within(list).getByRole('checkbox', { name: new RegExp(t) });
    expect(item(LAUNCH_CHECKS.arm).getAttribute('aria-checked')).toBe('false');
    expect(item(LAUNCH_CHECKS.go).getAttribute('aria-checked')).toBe('false');
    fireEvent.click(screen.getByRole('switch', { name: 'Arm' }));
    expect(item(LAUNCH_CHECKS.arm).getAttribute('aria-checked')).toBe('true');
    // exactly one step is lit: the first one still to do
    expect(list.querySelectorAll('li.todo').length).toBe(1);
  });
});

describe('◂ BACK on every step', () => {
  it('map, rescue, notebook and pack all go back the way you came', () => {
    vi.useFakeTimers();
    localStorage.setItem('sd.seen', JSON.stringify(['brief:moon-1']));
    render(<App />);
    const home = () => screen.getByRole('button', { name: /^Play: mission/ });
    // Home → map → back
    fireEvent.click(screen.getByRole('button', { name: 'CHOOSE A MISSION ▸' }));
    expect(screen.getByRole('heading', { name: 'Where will you fly next?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(home()).toBeTruthy();
    // Home → map → pack → back lands on the map, then Home
    fireEvent.click(screen.getByRole('button', { name: 'CHOOSE A MISSION ▸' }));
    fireEvent.click(screen.getByRole('button', { name: /^First Light/ }));
    pass(100);
    expect(screen.getByRole('group', { name: /Nose:/ })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Back' })[0]!);
    expect(screen.getByRole('heading', { name: 'Where will you fly next?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(home()).toBeTruthy();
    // Rescue History: a case goes back to the list, the list to Home
    fireEvent.click(screen.getByRole('button', { name: /^RESCUE HISTORY/ }));
    fireEvent.click(screen.getAllByRole('button', { name: /Mars Climate Orbiter/ })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getAllByRole('button', { name: /Mars Climate Orbiter/ }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(home()).toBeTruthy();
  });

  it('Back from a flight (after the warning) returns to Pack; Back from the report skips the finished flight', () => {
    vi.useFakeTimers();
    localStorage.setItem('sd.seen', JSON.stringify(['brief:mars', 'coach']));
    localStorage.setItem('mdt.progress', JSON.stringify({ 'moon-1': 1, 'moon-2': 1, 'moon-3': 1 }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'CHOOSE A MISSION ▸' }));
    fireEvent.click(screen.getByRole('button', { name: /^Red Planet/ }));
    pass(100);
    // arm and launch on the first good day
    fireEvent.click(screen.getByRole('switch', { name: 'Arm' }));
    const go = screen.getByRole('button', { name: 'LAUNCH' });
    if ((go as HTMLButtonElement).disabled) {
      const good = [...document.querySelectorAll<HTMLButtonElement>('.pk-day.good, .pk-day.soso')][0]!;
      fireEvent.click(good);
    }
    fireEvent.click(screen.getByRole('button', { name: 'LAUNCH' }));
    pass(100);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: LEAVE_CONFIRM.leave }));
    pass(100);
    expect(screen.getByRole('group', { name: /Nose:/ })).toBeTruthy();
    // fly again, finish, report, then Back: Pack, not the finished flight
    fireEvent.click(screen.getByRole('switch', { name: 'Arm' }));
    if ((screen.getByRole('button', { name: 'LAUNCH' }) as HTMLButtonElement).disabled) {
      fireEvent.click([...document.querySelectorAll<HTMLButtonElement>('.pk-day.good, .pk-day.soso')][0]!);
    }
    fireEvent.click(screen.getByRole('button', { name: 'LAUNCH' }));
    pass(100);
    fireEvent.click(screen.getByRole('button', { name: NAV.finish }));
    fireEvent.click(within(screen.getByRole('dialog', { name: FINISH_CONFIRM.title })).getByRole('button', { name: FINISH_CONFIRM.yes }));
    fireEvent.click(screen.getByRole('button', { name: 'SEE MISSION REPORT ▸' }));
    expect(screen.getByRole('heading', { name: 'MISSION REPORT' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('group', { name: /Nose:/ })).toBeTruthy();
  });
});
