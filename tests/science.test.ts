// Science targets in Mission operations (spec: Science targets and downlink). An OBSERVE order crosses space like
// every command, the craft prices the picture from its own orbit when the order lands, the picture waits for a DSN
// pass, and it counts once its last bit has left the craft. Science returned at Mars is the weight of the targets home.
import { describe, expect, it } from 'vitest';
import { presetDesign } from '../src/engine/missions';
import * as ops from '../src/engine/ops/index';
import { commandArrival, newsArrival } from '../src/engine/ops/commands';
import { firstScienceHome, observationFor, scienceReturned, targetScience } from '../src/engine/ops/observe';
import { dangerDeck } from '../src/engine/pack';
import { SCIENCE_RULES } from '../src/engine/science';
import { TARGETS, targetById } from '../src/engine/targets';
import type { OpsState } from '../src/engine/ops/types';

const maven = presetDesign('maven');
const calm = { rng: () => 0.999999 };
const DAY_S = 86_400;

/** Fly to the first day of the science phase (the arrival news need not have reached Earth). */
function inOrbit(): OpsState {
  const s = ops.startOperations(maven, calm);
  const sci = s.env.timeline.find((w) => w.phase === 'science')!;
  return ops.advanceOperations(s, { until: sci.startDay + 0.1 });
}

const observe = (s: OpsState, targetId: string) => ops.sendCommand(s, { kind: 'observe', targetId });
const fly = (s: OpsState, days: number) => ops.advanceOperations(s, { days });

describe('an OBSERVE order', () => {
  it('crosses space like every command: it reaches the craft one light time later', () => {
    const s0 = inOrbit();
    const { state, receipt } = observe(s0, 'valles-marineris');
    expect(receipt.accepted).toBe(true);
    expect(receipt.arrivesAt).toBeCloseTo(commandArrival(s0.env, s0.t), 12);
    expect(state.actions.at(-1)).toEqual({ t: s0.t, kind: 'command', command: { kind: 'observe', targetId: 'valles-marineris' } });
    // Nothing happens on board before it lands.
    expect(state.images).toEqual([]);
  });

  it('when it lands the craft observes for the plan’s days, then keeps the picture until a DSN pass sends it', () => {
    const s0 = inOrbit();
    const { state, receipt } = observe(s0, 'valles-marineris');
    const s = fly(state, 3);
    const im = s.images.find((x) => x.targetId === 'valles-marineris')!;
    expect(im.startedAt).toBeCloseTo(receipt.arrivesAt!, 12);
    // Valles Marineris: one day of passes, no burn from MAVEN's 150 km periapsis (spec: Science targets).
    expect(im.takenAt).toBeCloseTo(im.startedAt + SCIENCE_RULES.observeDays.value, 12);
    expect(im.dv_ms).toBe(0);
    expect(im.status).toBe('sent');
    // It goes down on the first pass after it was taken: the pass opens passStart_h into the day.
    const open = (d: number) => d + SCIENCE_RULES.passStart_h.value / 24;
    const day = Math.floor(im.takenAt);
    const firstOpen = im.takenAt <= open(day) ? open(day) : open(day + 1);
    expect(im.sentAt!).toBeGreaterThanOrEqual(Math.max(im.takenAt, firstOpen) - 1e-9);
    // bits ÷ that day's link rate: under a minute for a 28 Mbit frame at Mars' distance.
    expect((im.sentAt! - Math.max(im.takenAt, firstOpen)) * DAY_S).toBeLessThan(600);
    // Home one light time after the last bit leaves.
    expect(im.homeAt!).toBeCloseTo(newsArrival(s.env, im.sentAt!), 12);
    expect(s.events.some((e) => e.code === 'image-sent' && e.values.targetId === 'valles-marineris')).toBe(true);
  });

  it('a target below the periapsis costs a burn from the vis-viva plan, charged when the order lands', () => {
    const s0 = inOrbit();
    const plan = observationFor(s0, targetById('olympus-mons')!);
    expect(plan.dvOrbit_ms).toBeGreaterThan(0);
    const s = fly(observe(s0, 'olympus-mons').state, 0.5);
    const burn = s.events.find((e) => e.code === 'burn' && e.values.kind === 'observe')!;
    expect(Number(burn.values.dv_ms)).toBeCloseTo(plan.dv_ms, 6);
    expect(s.dvScience_ms).toBeCloseTo(plan.dv_ms, 6);
  });

  it('is refused (and costs nothing) when the craft cannot pay: Deimos needs 750 m/s from MAVEN’s orbit', () => {
    const s0 = inOrbit();
    const mass0 = s0.mass_kg;
    const s = fly(observe(s0, 'deimos').state, 0.5);
    const im = s.images.find((x) => x.targetId === 'deimos')!;
    expect(im.status).toBe('refused');
    expect(im.reason).toBe('fuel');
    expect(s.events.some((e) => e.code === 'burn' && e.values.kind === 'observe')).toBe(false);
    expect(s.mass_kg).toBeCloseTo(mass0, 9);
  });

  it('is refused before the craft is in orbit, and a second order for the same target is refused', () => {
    const cruise = ops.advanceOperations(ops.startOperations(maven, calm), { until: 50 });
    const early = fly(observe(cruise, 'phobos').state, 1);
    expect(early.images[0]!.reason).toBe('not-in-orbit');
    const s1 = fly(observe(inOrbit(), 'phobos').state, 0.2);
    const s2 = fly(observe(s1, 'phobos').state, 0.2);
    expect(s2.images.filter((x) => x.targetId === 'phobos').map((x) => x.status)).toEqual(['observing', 'refused']);
    expect(s2.images[1]!.reason).toBe('already-ordered');
  });

  it('never reshuffles the future: the hazard draws are made at the start', () => {
    const s0 = inOrbit();
    const s = fly(observe(s0, 'limb').state, 10);
    expect(s.draws).toBe(s0.draws);
  });

  it('a deep dip raises the drag-heating rate only while it lasts', () => {
    const s0 = inOrbit();
    const plan = observationFor(s0, targetById('limb')!);
    expect(plan.dragFactor).toBeGreaterThan(10);
    const s = fly(observe(s0, 'limb').state, 0.5);
    const im = s.images[0]!;
    expect(im.dragFactor).toBeCloseTo(plan.dragFactor, 9);
    expect(im.takenAt - im.startedAt).toBeCloseTo(plan.days, 9);
  });

  it('the science hazard is not in Pack’s danger deck: only an order in flight raises it', () => {
    expect(dangerDeck('mars', []).map((d) => d.id)).not.toContain('drag-heating');
  });
});

describe('science returned', () => {
  it('at Mars it is the weight of the targets whose pictures came home', () => {
    let s = inOrbit();
    expect(scienceReturned(s)).toBe(0);
    expect(firstScienceHome(s)).toBe(false);
    s = observe(s, 'valles-marineris').state;
    s = observe(s, 'phobos').state;
    s = fly(s, 5);
    // 0.16 + 0.20 = 0.36
    expect(targetScience(s).home).toEqual(['valles-marineris', 'phobos']);
    expect(scienceReturned(s)).toBeCloseTo(0.36, 12);
    expect(firstScienceHome(s)).toBe(true);
  });

  it('is the main score: the Debrief’s science score and the stars follow it', () => {
    let s = inOrbit();
    for (const t of ['olympus-mons', 'valles-marineris', 'north-polar-cap', 'phobos', 'limb']) s = observe(s, t).state;
    const done = ops.finishOperations(s);
    const d = ops.operationsDebrief(done);
    // Every target but Deimos (unaffordable): 1 − 0.12 = 0.88 → 88, three stars (≥ 80).
    expect(scienceReturned(done)).toBeCloseTo(0.88, 12);
    expect(d.scores.science).toBeCloseTo(88, 9);
    expect(d.stars).toBe(3);
  });

  it('a flight that never looks at anything earns no star', () => {
    const d = ops.operationsDebrief(ops.runOperations(maven, calm).state);
    expect(d.scores.science).toBe(0);
    expect(d.stars).toBe(0);
    expect(d.hint).toMatch(/order a science target/);
  });

  it('pictures already sent count even if the robot is lost afterwards; one cut off part-way does not', () => {
    let s = fly(observe(inOrbit(), 'phobos').state, 5);
    expect(targetScience(s).home).toEqual(['phobos']);
    // The craft is lost later, with another picture half sent.
    s = {
      ...s,
      status: 'lost',
      failureT: s.t,
      images: [...s.images, { ...s.images[0]!, targetId: 'limb', status: 'on-board', sentBits: s.images[0]!.bits / 2, sentAt: undefined, homeAt: undefined }],
    };
    const ts = targetScience(s);
    expect(ts.home).toEqual(['phobos']);
    expect(ts.partial).toEqual([{ targetId: 'limb', fraction: 0.5 }]);
    expect(ts.fraction).toBeCloseTo(targetById('phobos')!.weight.value, 12);
  });

  it('elsewhere it stays data downlinked ÷ goal', () => {
    const s = ops.runOperations(presetDesign('osiris-rex'), calm).state;
    const sci = s.env.timeline.find((w) => w.phase === 'science')!;
    const goal = s.env.loads.instruments.reduce((a, i) => a + i.data_bitsPerDay, 0) * (sci.endDay - sci.startDay + 1);
    expect(scienceReturned(s)).toBeCloseTo(Math.min(1, s.downlinkedPrime_bits / goal), 12);
    expect(TARGETS.length).toBe(6);
  });
});

describe('the robot asks, answers and reports', () => {
  it('at Mars the science phase opens with the question, the order gets a reply, the picture says it was sent', () => {
    let s = inOrbit();
    s = fly(observe(s, 'valles-marineris').state, 3);
    const kinds = ops.robotMessages(s).map((m) => m.kind);
    expect(kinds).toContain('targets');
    const reply = ops.robotMessages(s).find((m) => m.kind === 'observing')!;
    expect(reply.values.targetId).toBe('valles-marineris');
    expect(ops.robotMessages(s).find((m) => m.kind === 'image-sent')!.values.targetId).toBe('valles-marineris');
    const order = ops.transmissionFeed(s).entries.find((e) => e.order?.kind === 'observe')!.order!;
    expect(order.targetId).toBe('valles-marineris');
    expect(order.status).toBe('replied');
  });
});

describe('a Cadet Mars run lasts about five minutes at the default speed (100×)', () => {
  it('the Pack flies a short science campaign, so the clock runs about four minutes; decisions bring it to about five', async () => {
    const { starterDesign } = await import('../src/ui/starters');
    const { buildPackDesign, initialPack, shelfFor } = await import('../src/engine/pack');
    for (const date of ['2026-10-23', '2028-01-15', '2030-06-01']) {
      const base = starterDesign('mars', date);
      const d = buildPackDesign(base, initialPack(base, shelfFor('mars')));
      expect(d.scienceDays).toBe(SCIENCE_RULES.cadetCampaign_days.value);
      // (cruise 285–311 days + 1 arrival day + 100 science days) ÷ 100 days a minute ≈ 3.9–4.1 min
      const clock = ops.flightClock_s(ops.startOperations(d, calm), 100) / 60;
      expect(clock).toBeGreaterThan(3.5);
      expect(clock).toBeLessThan(4.5);
    }
  });

  it('the real MAVEN preset keeps its planned year', () => {
    expect(maven.scienceDays).toBe(365);
  });
});
