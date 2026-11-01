// @vitest-environment jsdom
// Team Fly (spec: Team mode, UI rule 51; design T4). A danger card goes through the team's vote: the related role
// recommends by tapping a card, the other seats tap their tokens, the Flight Director makes the final call, and only
// then does the order leave for the robot. Console orders and quick messages go on the team's log at the mission time;
// the team's lines print in TRANSMISSIONS. Seed 19: the first danger card is a solar storm (Comms & Ops recommends).
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect, useMemo, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { shelfFor } from '../../src/engine/pack';
import type { TeamAction } from '../../src/engine/team/log';
import { teamDesign } from '../../src/engine/team/reduce';
import { replayTeam } from '../../src/engine/team/replay';
import type { Team } from '../../src/engine/team/roles';
import { defaultTeam } from '../../src/engine/team/setup';
import * as f from '../../src/ui/format';
import { FlyAndSurvive } from '../../src/ui/screens/FlyAndSurvive';
import { QUICK_WORDS, ROLE_WORDS, TEAM_FLY_WORDS } from '../../src/ui/sdWords';
import { starterDesign } from '../../src/ui/starters';
import { useTeam } from '../../src/ui/useTeam';
import './setup';

const base = starterDesign('mars', '2028-11-15');
const shelf = shelfFor('mars');
const day = { date: base.launchDate, arrivalDate: base.arrivalDate };
const SEED = 19;
let log: readonly TeamAction[] = [];

/** A launched team (the Flight Director's launch is the log's second entry) flying on the shared screen. */
function Harness({ team }: { team: Team }) {
  const tp = useTeam();
  useEffect(() => {
    tp.start(team, base, shelf, { seed: SEED });
    tp.send('flight-director', { kind: 'launch', day });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const launched = tp.session?.team.launched === true;
  const design = useMemo(() => (launched ? teamDesign(tp.session!.team) : undefined), [launched]); // eslint-disable-line react-hooks/exhaustive-deps
  log = tp.log;
  // leaving the flight and coming back (BACK, then LAUNCH on the Pack): the screen starts from the team's flight
  const [away, setAway] = useState(false);
  const toggle = (
    <button type="button" onClick={() => setAway((x) => !x)}>
      away
    </button>
  );
  if (!design || !tp.session) return null;
  if (away) return toggle;
  return (
    <>
      {toggle}
      <FlyAndSurvive design={design} seed={SEED} mode="cadet" onMode={vi.fn()} missionName="Team" onHome={vi.fn()} onDone={vi.fn()} team={{ state: tp.session.team, log: tp.log, send: tp.send, ...(tp.session.ops ? { ops: tp.session.ops } : {}) }} />
    </>
  );
}

function pass(ms: number, step = 50) {
  for (let t = 0; t < ms; t += step) act(() => vi.advanceTimersByTime(step));
}

function open(team: Team) {
  vi.useFakeTimers();
  render(<Harness team={team} />);
  pass(100);
}

const toDanger = () => {
  for (let i = 0; i < 30 && !screen.queryByRole('dialog', { name: /DANGER CARD/ }); i++) act(() => fireEvent.click(screen.getByRole('button', { name: 'Next event' })));
  return screen.getByRole('dialog', { name: /DANGER CARD/ });
};
const strip = () => screen.getByRole('group', { name: TEAM_FLY_WORDS.whose });
const current = () => strip().querySelector('[aria-current="step"]')?.textContent ?? '';
const last = () => log[log.length - 1]!;

describe('Team Fly: the danger card vote (T4)', () => {
  it('Comms & Ops recommends, the Engineer and Science vote with their tokens, the Flight Director calls; then the order leaves', () => {
    open(defaultTeam(4));
    const card = toDanger();
    // step 1: the related role recommends; the tokens wait
    expect(current()).toContain(TEAM_FLY_WORDS.stages.recommend);
    expect(current()).toContain(ROLE_WORDS['comms-ops'].name);
    expect(within(card).getByText(TEAM_FLY_WORDS.recommendNow(ROLE_WORDS['comms-ops'].name))).toBeTruthy();
    const [a, b] = within(card).getAllByRole('button', { name: /: / }).filter((x) => x.classList.contains('dc-choice'));
    expect(within(card).getAllByRole('button', { name: /: vote / }).every((t) => (t as HTMLButtonElement).disabled)).toBe(true);
    // FINAL CALL waits for the recommendation
    expect(screen.getByRole('status', { name: '' }).textContent).toContain(TEAM_FLY_WORDS.recommendNow(ROLE_WORDS['comms-ops'].ab));

    fireEvent.click(a!);
    const rec = last();
    expect(rec).toMatchObject({ role: 'comms-ops', seat: 'p4', act: { kind: 'recommend' } });
    expect(rec.t).toBeGreaterThan(0);
    // the card stays open: step 2, the votes
    expect(screen.getByRole('dialog', { name: /DANGER CARD/ })).toBeTruthy();
    expect(current()).toContain(TEAM_FLY_WORDS.stages.vote);
    expect(within(card).getByText(new RegExp(TEAM_FLY_WORDS.recommendedBy(ROLE_WORDS['comms-ops'].name, defaultTeam(4).seats[3]!.callSign)))).toBeTruthy();
    // Comms & Ops' token sits on A; the two other voters tap theirs
    expect(within(card).getAllByRole('button', { name: `${ROLE_WORDS['comms-ops'].name} voted ${TEAM_FLY_WORDS.letters[0]}` }).map((t) => t.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    fireEvent.click(within(card).getAllByRole('button', { name: `${ROLE_WORDS['spacecraft-engineer'].name}: vote ${TEAM_FLY_WORDS.letters[1]}` })[0]!);
    expect(last()).toMatchObject({ role: 'spacecraft-engineer', act: { kind: 'vote' }, t: rec.t });
    fireEvent.click(within(card).getAllByRole('button', { name: `${ROLE_WORDS['science-lead'].name}: vote ${TEAM_FLY_WORDS.letters[1]}` })[0]!);
    // step 3: everyone has spoken, the team leans B
    expect(current()).toContain(TEAM_FLY_WORDS.stages.call);
    expect(document.querySelector('.tf-call')!.textContent).toContain(`${TEAM_FLY_WORDS.leans(TEAM_FLY_WORDS.letters[1]!)} · ${TEAM_FLY_WORDS.tapCard}`);

    // the Flight Director's final call: B. Only now does the card close and the order fly.
    fireEvent.click(b!);
    expect(last()).toMatchObject({ role: 'flight-director', seat: 'p1', act: { kind: 'call' }, t: rec.t });
    expect(screen.queryByRole('dialog', { name: /DANGER CARD/ })).toBeNull();
    expect(document.querySelector('.fly-countdown')).toBeTruthy();
    // the team's lines are on the teletype
    const tx = screen.getByRole('log', { name: /./ });
    expect(within(tx).getAllByText(/^RECOMMEND |^VOTE |^FINAL CALL · /)).toHaveLength(4);
  });

  it('a team of one: the recommendation is the call, and the order leaves at once', () => {
    open(defaultTeam(1));
    const card = toDanger();
    expect(within(card).getByText(TEAM_FLY_WORDS.soloCall)).toBeTruthy();
    expect(strip().querySelectorAll('.tf-step')).toHaveLength(1);
    expect(within(card).queryAllByRole('button', { name: /: vote / })).toHaveLength(0);
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
    });
    expect(last()).toMatchObject({ seat: 'p1', role: 'comms-ops', act: { kind: 'recommend' } });
    expect(screen.queryByRole('dialog', { name: /DANGER CARD/ })).toBeNull();
  });
});

describe('Team Fly: orders and messages on the team log', () => {
  it('console keys wear their role; a power plan goes on the log as the Engineer, at the mission time; quick messages print in TRANSMISSIONS', () => {
    open(defaultTeam(4));
    const power = screen.getByRole('button', { name: /POWER PLAN/ });
    expect(power.classList.contains('tm-r-spacecraft-engineer')).toBe(true);
    expect(power.getAttribute('title')).toBe(TEAM_FLY_WORDS.keyOwner(power.textContent!, ROLE_WORDS['spacecraft-engineer'].name));
    fireEvent.click(power);
    fireEvent.click(screen.getByRole('switch', { name: /radio/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Send plan' }));
    expect(last()).toMatchObject({ seat: 'p2', role: 'spacecraft-engineer', act: { kind: 'ops', op: { kind: 'command', command: { kind: 'power-plan' } } } });
    expect(last().t).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: `Speak as ${ROLE_WORDS['science-lead'].name}` }));
    fireEvent.click(screen.getByRole('button', { name: QUICK_WORDS['science-first']! }));
    expect(last()).toMatchObject({ seat: 'p3', role: 'science-lead', act: { kind: 'say', quick: 'science-first' } });
    expect(within(screen.getByRole('log', { name: /./ })).getByText(QUICK_WORDS['science-first']!)).toBeTruthy();
  });

  it('the log replays to the flight on screen: the same orders, at the same times', () => {
    open(defaultTeam(4));
    toDanger();
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' }); // Comms & Ops recommends A
    });
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' }); // the Flight Director calls A (two voices still out)
    });
    expect(screen.queryByRole('dialog', { name: /DANGER CARD/ })).toBeNull();
    const rep = replayTeam(base, shelf, { seed: SEED }, log);
    const decided = rep.ops!.actions.find((x) => x.kind === 'decide');
    expect(decided).toMatchObject({ kind: 'decide', t: log.find((x) => x.act.kind === 'call')!.t });
    expect(rep.team.votes[(decided as { decisionId: string }).decisionId]!.result!.how).toBe('call');
  });

  it('a team that leaves the flight and comes back flies on from its log, not from launch day', () => {
    open(defaultTeam(4));
    toDanger();
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
    });
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
    });
    const called = log.find((x) => x.act.kind === 'call')!;
    fireEvent.click(screen.getByRole('button', { name: 'away' }));
    expect(screen.queryByRole('dialog', { name: /DANGER CARD/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'away' }));
    pass(100);
    // the clock opens where the team's flight stands: the day of the call, with the order on its way
    expect(document.querySelector('.ops-day-num')!.textContent).toBe(f.dayPad(Math.floor(called.t!)));
    expect(screen.queryByRole('dialog', { name: /DANGER CARD/ })).toBeNull();
  });
});
