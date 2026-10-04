// Signal Delay Pack (engine: src/engine/pack.ts, data: src/data/pack.json). The nose is volume (a 6 × 6 grid of
// squares); mass is a separate limit (the launch meter). Every packed part changes the design through
// evaluateDesign or Mission operations. Hand calculations in comments.
import { describe, expect, it } from 'vitest';
import { HAZARDS, PARTS } from '../src/engine/data';
import { evaluateDesign } from '../src/engine/index';
import { advanceOperations, consoleView, startOperations } from '../src/engine/ops/index';
import { effectiveFailureChance } from '../src/engine/ops/responses';
import {
  buildPackDesign,
  calendarTransfers,
  dangerDeck,
  dayQuality,
  fitPart,
  initialPack,
  noseSquares,
  PACK,
  packBlockers,
  packPart,
  shelfFor,
  type Packed,
} from '../src/engine/pack';
import { starterDesign } from '../src/ui/starters';

const FROM = '2026-10-05';
const mars = starterDesign('mars', FROM);
const area = (id: keyof typeof PACK.parts) => PACK.parts[id].w.value * PACK.parts[id].h.value;

describe('the nose (volume)', () => {
  it('a 6 × 6 grid; parts go in the first free slot, row by row', () => {
    expect(PACK.grid.cols.value).toBe(6);
    expect(PACK.grid.rows.value).toBe(6);
    // computer 2×2 at (0,0); engine 2×1 next to it at (0,2)
    let p: Packed = [];
    p = packPart(p, 'computer')!;
    p = packPart(p, 'engine')!;
    expect(p).toEqual([
      { id: 'computer', r: 0, c: 0 },
      { id: 'engine', r: 0, c: 2 },
    ]);
    expect(noseSquares(p)).toEqual({ used: 4 + 2, free: 36 - 6, total: 36 });
  });

  it('a part that has no free slot does not fit (no room in the nose)', () => {
    // fill the nose: six 3 × 1 bumpers would need 18; use solar (3×1) and bumpers until full
    let p: Packed = [];
    const big: (keyof typeof PACK.parts)[] = ['sniffer', 'sniffer', 'sniffer', 'sniffer', 'sniffer', 'sniffer'];
    // sniffer 2×3 = 6 squares: six of them fill 36 (packPart ignores duplicates by id, so place them directly)
    for (const [i] of big.entries()) p = [...p, { id: 'sniffer', r: Math.floor(i / 3) * 3, c: (i % 3) * 2 }];
    expect(noseSquares(p).free).toBe(0);
    expect(fitPart(p, 'heater')).toBeUndefined();
    expect(packPart(p, 'heater')).toBeUndefined();
  });

  it('removing a part frees its squares; packing the same part twice does nothing', () => {
    const p = packPart(packPart([], 'computer')!, 'shield')!;
    expect(packPart(p, 'shield')).toEqual(p);
    const left = p.filter((x) => x.id !== 'shield');
    expect(noseSquares(left).used).toBe(area('computer'));
  });
});

describe('the packed craft (one model)', () => {
  it('the starter pack: locked computer and engine, plus the starter’s instruments', () => {
    const p = initialPack(mars, shelfFor('mars'));
    expect(p.map((x) => x.id).slice(0, 2)).toEqual(['computer', 'engine']);
    const d = buildPackDesign(mars, p);
    expect(d.instrumentIds).toEqual(mars.instrumentIds);
    expect(d.kit).toBeUndefined();
  });

  it('science parts set the instruments; the dish sets the 3 m antenna', () => {
    const p = packPart(packPart(packPart(packPart([], 'computer')!, 'engine')!, 'camera')!, 'dish')!;
    const d = buildPackDesign(mars, p);
    expect(d.instrumentIds).toEqual(['camera']);
    expect(d.comms.dishDiameter_m).toBe(3);
  });

  it('solar adds array area; the tank adds 20% propellant; the battery 1.5 × capacity', () => {
    const base = initialPack(mars, shelfFor('mars'));
    const plain = buildPackDesign(mars, base);
    const more = buildPackDesign(mars, packPart(packPart(packPart(base, 'solar')!, 'tank')!, 'battery')!);
    expect(more.power.arrayArea_m2).toBeCloseTo((plain.power.arrayArea_m2 ?? 0) + 4, 9);
    expect(more.propellant_kg).toBeCloseTo(plain.propellant_kg * 1.2, 6);
    expect(more.kit!.batteryFactor).toBe(1.5);
    const e0 = evaluateDesign(plain);
    const e1 = evaluateDesign(more);
    expect(e1.details.power.battery.capacity_Wh).toBeCloseTo(1.5 * e0.details.power.battery.capacity_Wh, 6);
    expect(e1.meters.deltaV.margin).toBeGreaterThan(e0.meters.deltaV.margin);
  });

  it('kit parts add their mass to the roll-up (30% growth included) and carry their protections', () => {
    const base = initialPack(mars, shelfFor('mars'));
    const plain = evaluateDesign(buildPackDesign(mars, base));
    const d = buildPackDesign(mars, packPart(packPart(base, 'shield')!, 'autopilot')!);
    // shield 40 kg + autopilot 2 kg = 42 kg → dry mass +42 × 1.3 = 54.6 kg
    expect(d.kit!.extraMass_kg).toBe(42);
    expect(evaluateDesign(d).details.dryMass_kg - plain.details.dryMass_kg).toBeCloseTo(54.6, 6);
    expect(d.kit!.hazardFactor!['solar-storm']).toBe(0.5);
    expect(d.kit!.autopilot).toBe(true);
    expect(effectiveFailureChance(d, 'solar-storm', 0.2)).toBeCloseTo(0.1, 12);
    expect(effectiveFailureChance(d, 'debris', 0.2)).toBeCloseTo(0.2, 12);
  });

  it('a shield halves the failure chance the danger card shows (and the outcome uses)', () => {
    const base = initialPack(mars, shelfFor('mars'));
    const shielded = buildPackDesign(mars, packPart(base, 'shield')!);
    const a = (d: typeof shielded) => {
      const s = advanceOperations(startOperations(d, { seed: 2013 }));
      return consoleView(s).alert;
    };
    const plain = a(buildPackDesign(mars, base));
    const safe = a(shielded);
    if (plain && safe && plain.type === 'solar-storm') {
      for (const o of safe.options) expect(o.failureChance.value).toBeCloseTo(plain.options.find((x) => x.id === o.id)!.failureChance.value * 0.5, 12);
    }
  });
});

describe('blockers name the limit that failed', () => {
  it('too heavy for this rocket: the launch meter is over', () => {
    const p = initialPack(mars, shelfFor('mars'));
    const heavy = { ...buildPackDesign(mars, p), propellant_kg: 20000 };
    const b = packBlockers(p, evaluateDesign(heavy));
    expect(b.map((x) => x.code)).toContain('too-heavy');
  });

  it('no science packed is a blocker of its own', () => {
    const p: Packed = packPart(packPart([], 'computer')!, 'engine')!;
    expect(packBlockers(p, evaluateDesign(buildPackDesign(mars, p))).map((x) => x.code)).toContain('no-science');
  });

  it('a flyable pack has no blockers', () => {
    const p = initialPack(mars, shelfFor('mars'));
    expect(packBlockers(p, evaluateDesign(buildPackDesign(mars, p)))).toEqual([]);
  });
});

describe('the danger deck', () => {
  it('Mars: the destination’s hazards plus the foreseeable eclipse season and solar conjunction', () => {
    const deck = dangerDeck('mars', []);
    const ids = deck.map((d) => d.id);
    expect(ids.slice(0, 2)).toEqual(['eclipse', 'conjunction']);
    for (const [id, h] of Object.entries(HAZARDS)) {
      if (h.options.length && h.destinations.includes('mars')) expect(ids).toContain(id);
    }
    expect(deck.every((d) => d.stamp === 'none')).toBe(true);
  });

  it('coverage: two parts → COVERED, one → SOME (game rule)', () => {
    const p = [{ id: 'solar' as const, r: 0, c: 0 }, { id: 'battery' as const, r: 1, c: 0 }, { id: 'shield' as const, r: 2, c: 0 }];
    const deck = dangerDeck('mars', p);
    expect(deck.find((d) => d.id === 'eclipse')!.stamp).toBe('covered');
    expect(deck.find((d) => d.id === 'eclipse')!.parts).toEqual(['solar', 'battery']);
    expect(deck.find((d) => d.id === 'solar-storm')!.stamp).toBe('some');
    expect(deck.find((d) => d.id === 'debris')!.stamp).toBe('none');
  });

  it('honest coverage: the tank covers exactly the hazards with a Δv-costing response; solar the ones that need power', () => {
    const dv = Object.entries(HAZARDS).filter(([, h]) => h.options.some((o) => (o.cost.deltaV_ms?.value ?? 0) > 0)).map(([id]) => id);
    expect([...PACK.parts.tank.covers].sort()).toEqual(dv.sort());
    const power = Object.entries(HAZARDS).filter(([, h]) => h.options.some((o) => o.requires?.powerMargin)).map(([id]) => id);
    for (const id of power) expect(PACK.parts.solar.covers).toContain(id);
  });

  it('the Moon has no conjunction (no lunar ephemeris)', () => {
    expect(dangerDeck('moon', []).map((d) => d.id)).not.toContain('conjunction');
  });
});

describe('the launch calendar', () => {
  it('six weeks of transfers around the best day; quality is the launch and Δv meters on that day', () => {
    const days = calendarTransfers('mars', mars.launchDate);
    expect(days.length).toBe(42);
    // the best day (the starter's) sits 20 days in
    expect(days[20]!.date).toBe(mars.launchDate);
    const d = buildPackDesign(mars, initialPack(mars, shelfFor('mars')));
    const ev = evaluateDesign(d);
    const q = days.map((t) => dayQuality(d, ev, t));
    expect(q[20]!.quality).toBe('good');
    for (const x of q) expect(['good', 'soso', 'bad']).toContain(x.quality);
    // quality = worst of the two margins' statuses: ok → good, warning → so-so, over → bad
    for (const x of q.filter((y) => y.massMargin !== undefined)) {
      const worst = Math.min(x.massMargin!, x.deltaVMargin!);
      expect(x.quality).toBe(worst < 0 ? 'bad' : worst < 0.1 ? 'soso' : 'good');
    }
  });

  it('far from the window, Mars is out of reach (bad days)', () => {
    const d = buildPackDesign(mars, initialPack(mars, shelfFor('mars')));
    const ev = evaluateDesign(d);
    const far = calendarTransfers('mars', '2027-06-01');
    expect(far.some((t) => dayQuality(d, ev, t).quality === 'bad')).toBe(true);
  });

  it('the Moon: every day is the same transfer', () => {
    const moon = starterDesign('moon', FROM);
    const days = calendarTransfers('moon', moon.launchDate);
    expect(new Set(days.map((t) => t.c3)).size).toBe(1);
    expect(PARTS.power.batteryMaxDepthOfDischarge.value).toBe(0.3);
  });
});
