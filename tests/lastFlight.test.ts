// Change one thing and fly again (spec UI rule 60; docs/SPACE_APPS_PLAN.md PR 6). The report names a Pack part that
// would have helped against the danger that hurt (packHint); Pack compares each mission limit with the last flight
// (limitChanges). Both read only engine outputs; hand calculations in comments.
import { describe, expect, it } from 'vitest';
import { evaluateDesign } from '../src/engine/index';
import { runOperations } from '../src/engine/ops/index';
import { packHint, reportVerdict } from '../src/engine/ops/report';
import { buildPackDesign, initialPack, limitChanges, PACK, packLimits, packPart, shelfFor, type PartId } from '../src/engine/pack';
import { starterDesign } from '../src/ui/starters';

const mars = starterDesign('mars', '2028-11-15');
const shelf = shelfFor('mars');
const p0 = initialPack(mars, shelf);

describe('the packed parts are on the design', () => {
  it('buildPackDesign records the packed part ids, in packing order', () => {
    const p = packPart(p0, 'shield')!;
    expect(buildPackDesign(mars, p).packedParts).toEqual(p.map((q) => q.id));
  });
});

describe('packHint: the part that would have helped', () => {
  // rng 0.05: hazards strike often and responses go badly (rng → 0 loses the launch itself), so "what hurt you" is a
  // bad outcome: the memory corruption, answered with a reboot. The spare computer guards against it (hazard factor).
  const unlucky = runOperations(buildPackDesign(mars, p0), { seed: 1, rng: () => 0.05, policy: 'safe' }).state;

  it('names an unpacked shelf part that protects against, or covers, the danger that hurt', () => {
    const hurt = reportVerdict(unlucky).hurt;
    expect(hurt.code).toBe('bad-outcome');
    if (hurt.code !== 'bad-outcome') return;
    const hint = packHint(unlucky, shelf)!;
    expect(hint.hazardType).toBe(hurt.hazardType);
    const part = PACK.parts[hint.part];
    expect(!!part.hazardFactor?.[hurt.hazardType] || (part.covers ?? []).includes(hurt.hazardType)).toBe(true);
    expect(unlucky.env.design.packedParts).not.toContain(hint.part);
    expect(shelf).toContain(hint.part);
  });

  it('the memory corruption names the spare computer; a solar storm (seed 6, risky answers) names the shield', () => {
    expect(packHint(unlucky, shelf)).toEqual({ part: 'spare', hazardType: 'memory-corruption' });
    const storm = runOperations(buildPackDesign(mars, p0), { seed: 6, policy: 'risky' }).state;
    expect(reportVerdict(storm).hurt).toMatchObject({ code: 'bad-outcome', hazardType: 'solar-storm' });
    expect(packHint(storm, shelf)).toEqual({ part: 'shield', hazardType: 'solar-storm' });
  });

  it('a part that guards against the danger directly (its hazard factor) comes before one that only covers it', () => {
    const hurt = reportVerdict(unlucky).hurt;
    if (hurt.code !== 'bad-outcome') return;
    const direct = shelf.find((id) => PACK.parts[id].hazardFactor?.[hurt.hazardType]);
    if (direct) expect(packHint(unlucky, shelf)!.part).toBe(direct);
  });

  it('nothing to name when every part that covers it is packed, off the shelf, or nothing hurt', () => {
    const hurt = reportVerdict(unlucky).hurt;
    if (hurt.code !== 'bad-outcome') return;
    const helpers = shelf.filter((id) => PACK.parts[id].hazardFactor?.[hurt.hazardType] || (PACK.parts[id].covers ?? []).includes(hurt.hazardType));
    const all = { ...unlucky, env: { ...unlucky.env, design: { ...unlucky.env.design, packedParts: [...(unlucky.env.design.packedParts ?? []), ...helpers] } } };
    expect(packHint(all, shelf)).toBeUndefined();
    expect(packHint(unlucky, shelf.filter((id) => !helpers.includes(id)))).toBeUndefined();
    const calm = runOperations(buildPackDesign(mars, p0), { seed: 1, rng: () => 0.999999, policy: 'safe' }).state;
    expect(reportVerdict(calm).hurt.code).not.toBe('bad-outcome');
    expect(packHint(calm, shelf)).toBeUndefined();
  });
});

describe('limitChanges: each mission limit against the last flight', () => {
  it('the change in what is used and in the limit, per bar, from the two sets of limits', () => {
    const last = packLimits(evaluateDesign(buildPackDesign(mars, p0)));
    const withCamera = packPart(p0, 'camera' as PartId)!;
    const now = packLimits(evaluateDesign(buildPackDesign(mars, withCamera)));
    const ch = limitChanges(now, last);
    expect(ch.map((c) => c.key)).toEqual(['weight', 'budget', 'power', 'data']);
    for (const c of ch) {
      const a = now.find((l) => l.key === c.key)!;
      const b = last.find((l) => l.key === c.key)!;
      expect(c.used).toBeCloseTo(a.used - b.used, 9);
      expect(c.limit).toBeCloseTo(a.limit - b.limit, 9);
      expect(c.lastFill).toBe(b.fill);
    }
    // the camera's development cost: +25 $M on the budget, no change to the cap
    expect(ch.find((c) => c.key === 'budget')!.used).toBeCloseTo(25, 9);
    expect(ch.find((c) => c.key === 'budget')!.limit).toBe(0);
    // the same craft twice: no change anywhere
    for (const c of limitChanges(last, last)) expect([c.used, c.limit]).toEqual([0, 0]);
  });
});
