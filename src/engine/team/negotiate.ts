// Team mode negotiation (spec: Team mode, Shared mass, budget and space). The launch mass, the development cost and
// the nose squares are shared by the whole team. Each role's spend is its own subsystems' share, taken from the same
// evaluation the meters show (the growth margin pro rata), so the roles add up exactly. Over a limit, the conflict
// names the roles with optional parts aboard; it is resolved when a later packing brings the craft back under.
import { evaluateDesign, type FullEvaluation } from '../index';
import { footprint, noseSquares, PACK, type PartId } from '../pack';
import type { TeamAction } from './log';
import { applyTeamAction, initialTeamState, teamDesign, type TeamState } from './reduce';
import { ROLE_IDS, TEAM_RULES, type RoleId } from './roles';
import type { Design } from '../types';

export type Resource = 'mass' | 'cost' | 'room';

export interface RoleSpend {
  /** Share of the launch mass (wet), kg. */
  mass_kg: number;
  /** Share of the development cost, $M. */
  cost_M: number;
  /** Nose squares its parts take. */
  squares: number;
}

export interface TeamSpend {
  roles: Record<RoleId, RoleSpend>;
  limits: { mass_kg: number; cost_M: number; squares: number };
  /** For a limit that is over: the roles with optional parts there, the biggest spender first. */
  over: Partial<Record<'mass' | 'cost', RoleId[]>>;
}

/** Part kinds that change the development cost (costBreakdown: instruments, the dish, the solar array or RTG). */
const COST_KINDS = new Set(['instrument', 'dish', 'power']);

const role = (kind: string): RoleId => TEAM_RULES.partRoles.value[kind]!;

/** The roles that packed optional parts touching a resource, ordered by their spend there (most first). */
function named(s: TeamState, roles: Record<RoleId, RoleSpend>, resource: Resource): RoleId[] {
  const key = resource === 'mass' ? 'mass_kg' : resource === 'cost' ? 'cost_M' : 'squares';
  const has = new Set<RoleId>();
  for (const q of s.packed) {
    const p = PACK.parts[q.id];
    if (p.locked || (resource === 'cost' && !COST_KINDS.has(p.kind))) continue;
    has.add(s.owners[q.id] ?? role(p.kind));
  }
  return ROLE_IDS.filter((r) => has.has(r)).sort((a, b) => roles[b][key] - roles[a][key]);
}

/** Each role's share of the mass, the cost and the squares, from the evaluation the Pack meters show. */
export function teamSpend(s: TeamState, ev: FullEvaluation): TeamSpend {
  const mb = ev.details.massBreakdown;
  const cb = ev.details.costBreakdown;
  const prop = ev.details.propellant_kg;
  const instruments = mb.instruments.reduce((a, i) => a + i.kg, 0);
  const kit = mb.subtotal - (mb.bus + instruments + mb.powerGeneration + mb.battery + mb.comms + mb.tanks);
  // dry mass per kg of roll-up subtotal: 1 + growth margin for a concept, as-flown ÷ subtotal for a real mission
  const k = (ev.meters.mass.used - prop) / mb.subtotal;
  const roles = Object.fromEntries(ROLE_IDS.map((r) => [r, { mass_kg: 0, cost_M: 0, squares: 0 }])) as Record<RoleId, RoleSpend>;
  const add = (r: RoleId, mass_kg: number, cost_M: number) => {
    roles[r].mass_kg += mass_kg;
    roles[r].cost_M += cost_M;
  };
  add(role('bus'), k * mb.bus, cb.bus);
  add(role('instrument'), k * instruments, cb.instruments.reduce((a, i) => a + i.cost_M, 0));
  add(role('power'), k * mb.powerGeneration, cb.power);
  add(role('battery'), k * mb.battery, 0);
  add(role('propellant'), k * mb.tanks + prop, 0);
  add(role('kit'), k * kit, 0);
  add(role('dish'), k * mb.comms, cb.comms);
  add(role('engine'), 0, cb.engine);
  for (const q of s.packed) roles[s.owners[q.id] ?? role(PACK.parts[q.id].kind)].squares += footprint(q.id).squares;

  const over: TeamSpend['over'] = {};
  if (ev.meters.mass.margin < 0) over.mass = named(s, roles, 'mass');
  if (ev.meters.cost.margin < 0) over.cost = named(s, roles, 'cost');
  return { roles, limits: { mass_kg: ev.meters.mass.limit, cost_M: ev.meters.cost.limit, squares: noseSquares(s.packed).total }, over };
}

export interface SpendShares {
  /** Each role's part of the mass and cost limits (for the bars) and of the total cost (the SHARE column). */
  roles: Record<RoleId, { massOfLimit: number; costOfLimit: number; costShare: number }>;
  /** What the craft uses of each limit, and how far over it is (0 when under). */
  mass: { used: number; limit: number; over: number };
  cost: { used: number; limit: number; over: number };
}

/** The Shared Limits panel's fractions (Team Pack): each role's part of each limit and of the cost, and any overrun. */
export function spendShares(sp: TeamSpend): SpendShares {
  const sum = (k: 'mass_kg' | 'cost_M') => ROLE_IDS.reduce((a, r) => a + sp.roles[r][k], 0);
  const mass = sum('mass_kg');
  const cost = sum('cost_M');
  const roles = Object.fromEntries(
    ROLE_IDS.map((r) => [r, { massOfLimit: sp.roles[r].mass_kg / sp.limits.mass_kg, costOfLimit: sp.roles[r].cost_M / sp.limits.cost_M, costShare: cost > 0 ? sp.roles[r].cost_M / cost : 0 }]),
  ) as SpendShares['roles'];
  return {
    roles,
    mass: { used: mass, limit: sp.limits.mass_kg, over: Math.max(0, mass - sp.limits.mass_kg) },
    cost: { used: cost, limit: sp.limits.cost_M, over: Math.max(0, cost - sp.limits.cost_M) },
  };
}

export interface Conflict {
  resource: Resource;
  /** The entry that went over (or, for space, the packing refused for no room). */
  raisedSeq: number;
  /** The role whose entry raised it. */
  by: RoleId;
  /** The roles in the conflict: the one that raised it, then the others with optional parts there. */
  roles: RoleId[];
  /** Space: the part that did not fit. */
  part?: PartId;
  /** The entry that brought the craft back under (space: packed that part); none if still open at launch. */
  resolvedSeq?: number;
}

/** Every conflict over the packing, from the log up to the launch. */
export function teamConflicts(base: Design, shelf: PartId[], log: readonly TeamAction[]): Conflict[] {
  let s = initialTeamState(base, shelf);
  const out: Conflict[] = [];
  const open = (r: Resource, part?: PartId) => out.find((c) => c.resource === r && c.resolvedSeq === undefined && c.part === part);
  const raise = (a: TeamAction, resource: Resource, roles: RoleId[], part?: PartId) =>
    out.push({ resource, raisedSeq: a.seq, by: a.role, roles: [a.role, ...roles.filter((r) => r !== a.role)], ...(part ? { part } : {}) });

  for (const a of log) {
    if (a.act.kind === 'launch') break;
    const r = applyTeamAction(s, a);
    if (a.act.kind !== 'pack' && a.act.kind !== 'unpack') {
      s = r.state;
      continue;
    }
    const part = a.act.part;
    if (r.refused === 'no-room' && !open('room', part)) {
      const ev = evaluateDesign(teamDesign(s));
      raise(a, 'room', named(s, teamSpend(s, ev).roles, 'room'), part);
    }
    if (r.refused) continue;
    s = r.state;
    if (a.act.kind === 'pack') {
      const c = open('room', part);
      if (c) c.resolvedSeq = a.seq;
    }
    const ev = evaluateDesign(teamDesign(s));
    const sp = teamSpend(s, ev);
    for (const res of ['mass', 'cost'] as const) {
      const isOver = ev.meters[res].margin < 0;
      const c = open(res);
      if (isOver && !c) raise(a, res, sp.over[res] ?? []);
      else if (!isOver && c) c.resolvedSeq = a.seq;
    }
  }
  return out;
}
