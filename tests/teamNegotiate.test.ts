// Team mode negotiation (spec: Team mode, Shared mass, budget and space). The craft's launch mass, development cost
// and nose squares are shared; each role's spend is its own subsystems' share (the growth margin pro rata), so the
// roles add up to exactly what the meters show. Going over names the roles that packed optional parts there, and a
// conflict is resolved when a later packing brings the craft back under.
import { describe, expect, it } from 'vitest';
import { evaluateDesign } from '../src/engine/index';
import { footprint, noseSquares, PACK, shelfFor } from '../src/engine/pack';
import { ROLE_IDS, TEAM_RULES, type RoleId, type Team } from '../src/engine/team/roles';
import { applyTeamAction, initialTeamState, teamDesign, type TeamState } from '../src/engine/team/reduce';
import { teamConflicts, teamSpend } from '../src/engine/team/negotiate';
import type { TeamAct, TeamAction } from '../src/engine/team/log';
import { starterDesign } from '../src/ui/starters';

// The 2030 window has the least lift: this packing ends 11 kg over (3,329 kg on a 3,318 kg limit).
const base = starterDesign('mars', '2030-06-01');
const shelf = shelfFor('mars');
const trio: Team = {
  seats: [
    { id: 'p1', callSign: TEAM_RULES.callSigns.value[0]!, roles: ['flight-director'] },
    { id: 'p2', callSign: TEAM_RULES.callSigns.value[1]!, roles: ['spacecraft-engineer'] },
    { id: 'p3', callSign: TEAM_RULES.callSigns.value[2]!, roles: ['science-lead', 'comms-ops'] },
  ],
};
const SEAT: Record<RoleId, 'p1' | 'p2' | 'p3'> = { 'flight-director': 'p1', 'spacecraft-engineer': 'p2', 'science-lead': 'p3', 'comms-ops': 'p3' };

function logOf(...entries: [RoleId, TeamAct][]): TeamAction[] {
  const setup: TeamAction = { seq: 1, seat: 'p1', role: 'flight-director', act: { kind: 'setup', team: trio } };
  return [setup, ...entries.map(([role, act], i): TeamAction => ({ seq: i + 2, seat: SEAT[role], role, act }))];
}
const pack = (role: RoleId, part: string): [RoleId, TeamAct] => [role, { kind: 'pack', part: part as never }];
const unpack = (role: RoleId, part: string): [RoleId, TeamAct] => [role, { kind: 'unpack', part: part as never }];

function stateOf(log: TeamAction[]): TeamState {
  return log.reduce((s, a) => applyTeamAction(s, a).state, initialTeamState(base, shelf));
}

const FULL = [
  pack('science-lead', 'camera'),
  pack('science-lead', 'spectrometer'),
  pack('comms-ops', 'dish'),
  pack('spacecraft-engineer', 'tank'),
  pack('spacecraft-engineer', 'solar'),
  pack('spacecraft-engineer', 'battery'),
  pack('spacecraft-engineer', 'bumper'),
  pack('spacecraft-engineer', 'heater'),
];

describe('each role’s spend', () => {
  it('the roles add up to the launch mass, the development cost and the squares used', () => {
    const s = stateOf(logOf(...FULL));
    const ev = evaluateDesign(teamDesign(s));
    const sp = teamSpend(s, ev);
    const sum = (k: 'mass_kg' | 'cost_M' | 'squares') => ROLE_IDS.reduce((a, r) => a + sp.roles[r][k], 0);
    expect(sum('mass_kg')).toBeCloseTo(ev.meters.mass.used, 9);
    expect(sum('cost_M')).toBeCloseTo(ev.meters.cost.used, 9);
    expect(sum('squares')).toBe(noseSquares(s.packed).used);
    expect(sp.limits).toEqual({ mass_kg: ev.meters.mass.limit, cost_M: ev.meters.cost.limit, squares: noseSquares(s.packed).total });
  });

  it('each role carries its own subsystems, with the 30% growth margin on its dry mass', () => {
    const s = stateOf(logOf(pack('science-lead', 'camera')));
    const ev = evaluateDesign(teamDesign(s));
    const mb = ev.details.massBreakdown;
    const sp = teamSpend(s, ev);
    const instruments = mb.instruments.reduce((a, i) => a + i.kg, 0);
    // dry = 1.3 × subtotal for a concept design
    expect(sp.roles['science-lead'].mass_kg).toBeCloseTo(1.3 * instruments, 9);
    expect(sp.roles['flight-director'].mass_kg).toBeCloseTo(1.3 * mb.bus, 9);
    expect(sp.roles['comms-ops'].mass_kg).toBeCloseTo(1.3 * mb.comms, 9);
    // the Engineer's share holds the propellant too
    expect(sp.roles['spacecraft-engineer'].mass_kg).toBeGreaterThan(ev.details.propellant_kg);
    const cb = ev.details.costBreakdown;
    expect(sp.roles['science-lead'].cost_M).toBeCloseTo(cb.instruments.reduce((a, i) => a + i.cost_M, 0), 9);
    expect(sp.roles['spacecraft-engineer'].cost_M).toBeCloseTo(cb.engine + cb.power, 9);
    // squares: the sniffer (2 × 3) and the camera (2 × 2) are the Science Lead's
    expect(sp.roles['science-lead'].squares).toBe(footprint('sniffer').squares + footprint('camera').squares);
  });

  it('under every limit nothing is over', () => {
    const s = stateOf(logOf(pack('science-lead', 'camera')));
    expect(teamSpend(s, evaluateDesign(teamDesign(s))).over).toEqual({});
  });

  it('over the launch mass it names the roles with optional parts aboard, the biggest spender first', () => {
    const s = stateOf(logOf(...FULL, pack('spacecraft-engineer', 'spare')));
    const ev = evaluateDesign(teamDesign(s));
    expect(ev.meters.mass.margin).toBeLessThan(0);
    const sp = teamSpend(s, ev);
    // the Engineer (propellant, power, kit) outweighs the Science Lead and Comms & Ops; the FD packed nothing optional
    expect(sp.over.mass).toEqual(['spacecraft-engineer', 'science-lead', 'comms-ops']);
    expect(sp.over.cost).toBeUndefined();
  });
});

describe('conflicts over the log', () => {
  it('over the mass is raised by the packing that crossed the line, and resolved by the one that came back under', () => {
    const log = logOf(...FULL, pack('spacecraft-engineer', 'spare'), unpack('spacecraft-engineer', 'heater'), unpack('spacecraft-engineer', 'spare'));
    const c = teamConflicts(base, shelf, log);
    expect(c).toHaveLength(1);
    // setup is seq 1 and FULL 2–9, so the spare (seq 10) raised it; the heater alone (8 kg × 1.3 = 10.4 kg, seq 11) is
    // not enough against 11 kg over; unpacking the spare (seq 12) is
    expect(c[0]).toMatchObject({ resource: 'mass', by: 'spacecraft-engineer', raisedSeq: 10, resolvedSeq: 12 });
    expect(c[0]!.roles).toEqual(['spacecraft-engineer', 'science-lead', 'comms-ops']);
  });

  it('a conflict still open at launch stays unresolved', () => {
    const log = logOf(...FULL, pack('spacecraft-engineer', 'spare'), ['flight-director', { kind: 'launch', day: { date: base.launchDate } }]);
    const c = teamConflicts(base, shelf, log);
    expect(c).toHaveLength(1);
    expect(c[0]!.resolvedSeq).toBeUndefined();
  });

  it('a part with no room raises a space conflict, resolved when that part is packed after someone makes room', () => {
    const squares = noseSquares(stateOf(logOf(...FULL)).packed);
    expect(squares.free).toBeLessThan(footprint('shield').squares);
    const log = logOf(...FULL, pack('spacecraft-engineer', 'shield'), unpack('science-lead', 'spectrometer'), unpack('comms-ops', 'dish'), pack('spacecraft-engineer', 'shield'));
    const c = teamConflicts(base, shelf, log).filter((x) => x.resource === 'room');
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ part: 'shield', by: 'spacecraft-engineer', raisedSeq: 10, resolvedSeq: 13 });
    // the asker first, then the other roles holding optional squares, most squares first
    expect(c[0]!.roles[0]).toBe('spacecraft-engineer');
    expect(new Set(c[0]!.roles)).toEqual(new Set(['spacecraft-engineer', 'science-lead', 'comms-ops']));
  });

  it('no conflicts in a packing that stays under every limit', () => {
    expect(teamConflicts(base, shelf, logOf(pack('science-lead', 'camera'), pack('spacecraft-engineer', 'tank')))).toEqual([]);
  });

  it('every part in the test fits the nose grid it is checked against', () => {
    for (const [, a] of FULL) if (a.kind === 'pack') expect(PACK.parts[a.part]).toBeDefined();
  });
});
