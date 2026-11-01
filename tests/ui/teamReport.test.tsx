// @vitest-environment jsdom
// TEAM DEBRIEF (spec: Team mode, Team report, UI rule 52; design T5): after the Mission Album and before FINAL
// TRANSMISSION, one row per role with its key decision and a stamp, and the TEAM SCORE in its parts. Every count and
// the score come from the engine's teamReport. A flight without a team has no debrief.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { advanceOperations, finishOperations, openDecisions } from '../../src/engine/ops/index';
import { shelfFor } from '../../src/engine/pack';
import type { TeamAct } from '../../src/engine/team/log';
import { initialTeamState, teamDesign } from '../../src/engine/team/reduce';
import { stepSession, type TeamSession } from '../../src/engine/team/replay';
import { teamReport } from '../../src/engine/team/report';
import { holderOf, TEAM_RULES, type RoleId } from '../../src/engine/team/roles';
import { defaultTeam } from '../../src/engine/team/setup';
import { LocalTransport } from '../../src/engine/team/transport';
import * as f from '../../src/ui/format';
import { MissionReport } from '../../src/ui/screens/MissionReport';
import { ALBUM, FINAL_WORDS, ROLE_WORDS, TEAM_REPORT_WORDS } from '../../src/ui/sdWords';
import { starterDesign } from '../../src/ui/starters';
import './setup';

const base = starterDesign('mars', '2028-11-15');
const shelf = shelfFor('mars');
const opts = { seed: 19 }; // a solar storm in cruise (Comms & Ops) and an insertion anomaly (the Engineer)

/** Four players fly Mars with the moons objective: the related role recommends each card, the Flight Director calls it. */
function flyTeam() {
  const team = defaultTeam(4);
  const tr = new LocalTransport();
  let sess: TeamSession = { team: initialTeamState(base, shelf) };
  tr.subscribe((a) => (sess = stepSession(sess, a, opts).session));
  const send = (role: RoleId, act: TeamAct) => tr.send({ seat: holderOf(team, role) ?? 'p1', role, act, ...(sess.ops ? { t: sess.ops.t } : {}) });
  send('flight-director', { kind: 'setup', team });
  send('science-lead', { kind: 'pack', part: 'spectrometer' });
  send('flight-director', { kind: 'objective', objective: 'moons' });
  for (const r of ['spacecraft-engineer', 'science-lead', 'comms-ops'] as const) send(r, { kind: 'objective-voice', voice: 'agree' });
  send('flight-director', { kind: 'objective-lock' });
  send('flight-director', { kind: 'launch', day: { date: base.launchDate, arrivalDate: base.arrivalDate } });
  let observed = false;
  while (sess.ops!.status === 'flying') {
    const sci = sess.ops!.env.timeline.find((w) => w.phase === 'science')!;
    sess = { ...sess, ops: advanceOperations(sess.ops!, observed ? {} : { until: sci.startDay + 0.1 }) };
    if (!observed && sess.ops!.t >= sci.startDay) {
      observed = true;
      for (const id of ['phobos', 'valles-marineris']) send('science-lead', { kind: 'ops', op: { kind: 'command', command: { kind: 'observe', targetId: id } } });
    }
    for (const d of openDecisions(sess.ops!)) {
      if (d.kind !== 'hazard') continue;
      const type = sess.ops!.hazards.find((h) => h.id === d.hazardId)!.type;
      send(TEAM_RULES.hazardRoles.value[type]!, { kind: 'recommend', decisionId: d.id, optionId: d.safestOptionId! });
      send('flight-director', { kind: 'call', decisionId: d.id, optionId: d.safestOptionId! });
    }
  }
  return { log: tr.log(), state: sess.team, ops: finishOperations(sess.ops!) };
}

const flight = flyTeam();
const report = teamReport(flight.log, { team: flight.state, ops: flight.ops });

function open(team = true) {
  vi.useFakeTimers();
  render(
    <MissionReport
      state={flight.ops}
      design={teamDesign(flight.state)}
      mode="cadet"
      onMode={vi.fn()}
      missionName="Team"
      onFlyAgain={vi.fn()}
      onHome={vi.fn()}
      homeLabel="MISSION MAP"
      {...(team ? { team: { state: flight.state, log: flight.log } } : {})}
    />,
  );
}

describe('Team Debrief (T5)', () => {
  it('comes after the album and before FINAL TRANSMISSION: NEXT brings the robot’s last message', () => {
    open();
    expect(screen.queryByRole('region', { name: TEAM_REPORT_WORDS.label })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: ALBUM.feed }));
    expect(screen.getByRole('region', { name: TEAM_REPORT_WORDS.label })).toBeTruthy();
    expect(screen.queryByRole('button', { name: FINAL_WORDS.feed })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(TEAM_REPORT_WORDS.next) }));
    expect(screen.getByRole('button', { name: FINAL_WORDS.feed })).toBeTruthy();
  });

  it('one row per role with its seat, key decision and stamp; the score and its parts from the engine', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: ALBUM.feed }));
    const td = screen.getByRole('region', { name: TEAM_REPORT_WORDS.label });
    const rows = within(td).getAllByRole('listitem');
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual(report.rows.map((r) => `${ROLE_WORDS[r.role].name} · ${r.callSign}`));
    // the Flight Director's key decision is the locked objective, met or not
    const fd = rows[0]!;
    expect(fd.textContent).toContain(TEAM_REPORT_WORDS.call.objective('VISIT THE MOONS', false));
    expect(fd.querySelector('.td-stamp')!.textContent).toBe(TEAM_REPORT_WORDS.verdict.objective![report.objective!.met ? 'good' : 'bad']);
    // Comms & Ops recommended on the solar storm, and the team went with it
    const comms = report.rows.find((r) => r.role === 'comms-ops')!;
    expect(comms.key.kind).toBe('card');
    if (comms.key.kind === 'card') expect(rows[3]!.textContent).toContain(TEAM_REPORT_WORDS.call.agreed(f.num(comms.key.support), f.num(comms.key.against)));
    // the score and each part
    const score = within(td).getByRole('group', { name: TEAM_REPORT_WORDS.score });
    expect(score.querySelector('.td-score-v')!.textContent).toBe(f.num(report.score));
    for (const p of report.parts) expect(within(score).getByText(TEAM_REPORT_WORDS.parts[p.id])).toBeTruthy();
    expect(within(score).getByText(TEAM_REPORT_WORDS.votesLine(f.num(report.votes.agreed), f.num(report.votes.total)))).toBeTruthy();
    expect(within(score).getByText(TEAM_REPORT_WORDS.noConflicts)).toBeTruthy();
  });

  it('a solo flight has no Team section', () => {
    open(false);
    fireEvent.click(screen.getByRole('button', { name: ALBUM.feed }));
    expect(screen.queryByRole('region', { name: TEAM_REPORT_WORDS.label })).toBeNull();
    expect(screen.getByRole('button', { name: FINAL_WORDS.feed })).toBeTruthy();
  });
});
