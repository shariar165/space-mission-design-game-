// The robot's voice (engine: src/engine/ops/voice.ts). The craft talks about what happens to it, and every message
// reaches Earth one light time later: t_arrive = t_sent + d(t_sent) / c (spec: Mission operations, light time).
// Messages are data (a kind, a time, values); the words live in the UI (sdWords VOICE).
import { describe, expect, it } from 'vitest';
import { presetDesign } from '../src/engine/missions';
import * as ops from '../src/engine/ops/index';
import { newsArrival, oneWayAt } from '../src/engine/ops/commands';
import { defaultPowerPlan } from '../src/engine/ops/resources';
import { heardMessages, robotMessages, transmissionFeed, VOICE_RULES } from '../src/engine/ops/voice';

const maven = presetDesign('maven');
const DAY_S = 86_400;
const calm = () => ops.runOperations(maven, { rng: () => 0.999999 }).state;

describe('robot messages', () => {
  it('a calm MAVEN flight: launch, halfway, arrival, science on, the dark, the Sun in the way, prime done', () => {
    const s = calm();
    const kinds = robotMessages(s).map((m) => m.kind);
    expect(kinds[0]).toBe('launch');
    for (const k of ['halfway', 'arrived', 'science', 'dark', 'conjunction', 'conjunction-end', 'prime-complete'] as const) expect(kinds).toContain(k);
    // halfway is the middle of the cruise: arrivalDay / 2 (MAVEN arrives on day 307 → 153.5)
    expect(robotMessages(s).find((m) => m.kind === 'halfway')!.sentAt).toBeCloseTo(s.env.arrivalDay / 2, 9);
    // in time order
    const t = robotMessages(s).map((m) => m.sentAt);
    expect([...t].sort((a, b) => a - b)).toEqual(t);
  });

  it('each message reaches Earth one light time after the craft sends it', () => {
    const s = calm();
    for (const m of robotMessages(s)) {
      const oneWay = oneWayAt(s.env, m.sentAt);
      expect(m.delay_s).toBeCloseTo(oneWay, 6);
      expect(m.receivedAt).toBeCloseTo(m.sentAt + oneWay / DAY_S, 12);
    }
    // At Mars the light time is minutes: between about 3 and 22 minutes
    const at = robotMessages(s).find((m) => m.kind === 'science')!;
    expect(at.delay_s / 60).toBeGreaterThan(3);
    expect(at.delay_s / 60).toBeLessThan(23);
  });

  it('seq counts the messages of each kind (the UI picks its words by it)', () => {
    // Fly into the extension so several eclipse seasons pass (MAVEN: one in the prime mission, more after).
    const s = ops.runOperations(maven, { rng: () => 0.999999, extension: 'longest' }).state;
    const seasons = s.events.filter((e) => e.code === 'eclipse-season-start').length;
    expect(seasons).toBeGreaterThan(1);
    const dark = robotMessages(s).filter((m) => m.kind === 'dark');
    expect(dark.map((m) => m.seq)).toEqual(Array.from({ length: seasons }, (_, i) => i));
  });

  it('the same seed gives the same messages', () => {
    const a = robotMessages(ops.runOperations(maven, { seed: 2013 }).state);
    const b = robotMessages(ops.runOperations(maven, { seed: 2013 }).state);
    expect(b).toEqual(a);
  });

  it('a hazard: the robot says it was hit, then whether the answer worked', () => {
    const s = ops.runOperations(maven, { seed: 2013 }).state;
    const msgs = robotMessages(s);
    const hits = msgs.filter((m) => m.kind === 'hit');
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) expect(s.hazards.some((x) => x.id === h.values.hazardId && x.type === h.values.hazardType)).toBe(true);
    const outcomes = s.events.filter((e) => e.code === 'response-outcome');
    expect(msgs.filter((m) => m.kind === 'saved' || m.kind === 'hurt').length).toBe(outcomes.length);
    for (const e of outcomes) {
      const m = msgs.find((x) => (x.kind === 'saved' || x.kind === 'hurt') && x.values.hazardId === e.values.hazardId)!;
      expect(m.kind).toBe(e.values.bad ? 'hurt' : 'saved');
    }
  });

  it('a brownout (low battery) streak is one message, not one a day', () => {
    for (const m of robotMessages(ops.runOperations(maven, { seed: 2013 }).state).filter((x) => x.kind === 'brownout')) expect(m.values.streak).toBe(1);
  });

  it('a lost craft: its last message is its last words', () => {
    // Seed 6: lost in the science phase after a missed deadline (the robot's default answer failed).
    const s = ops.runOperations(maven, { seed: 6, policy: 'default' }).state;
    expect(s.status).toBe('lost');
    const msgs = robotMessages(s);
    expect(msgs[msgs.length - 1]!.kind).toBe('last-words');
    expect(msgs[msgs.length - 1]!.sentAt).toBeCloseTo(s.failureT!, 9);
  });

  it('a launch failure: the only message is from the pad', () => {
    const s = ops.runOperations(maven, { rng: () => 0 }).state;
    expect(robotMessages(s).map((m) => m.kind)).toEqual(['launch-failed']);
  });

  it('the last-words line cites real history, marked to verify', () => {
    expect(VOICE_RULES.lastWordsHistory.isGameEstimate).toBe(true);
    expect(VOICE_RULES.lastWordsHistory.value).toMatch(/Opportunity/);
  });
});

describe('heard messages (what Earth has received by now)', () => {
  it('a message is heard only once it has arrived; until then it is incoming', () => {
    const full = calm();
    const m = robotMessages(full).find((x) => x.kind === 'science')!;
    // Fly to just after the craft sent it, before it reaches Earth.
    const mid = m.sentAt + (m.receivedAt - m.sentAt) / 2;
    let s = ops.startOperations(maven, { rng: () => 0.999999 });
    for (let i = 0; i < 1000 && s.t < mid - 1e-12 && s.status === 'flying'; i++) s = ops.advanceOperations(s, { until: mid });
    let h = heardMessages(s);
    expect(h.heard.some((x) => x.kind === 'science' && x.sentAt === m.sentAt)).toBe(false);
    expect(h.incoming).toBeDefined();
    expect(h.incoming!.inFlight_s).toBeCloseTo((m.receivedAt - s.t) * DAY_S, 3);
    s = ops.advanceOperations(s, { until: m.receivedAt + 1e-6 });
    h = heardMessages(s);
    expect(h.heard[h.heard.length - 1]!.kind).toBe('science');
    expect(h.latest!.kind).toBe('science');
  });

  it('a finished flight has heard everything', () => {
    const s = calm();
    const h = heardMessages(s);
    expect(h.heard.length).toBe(robotMessages(s).length);
    expect(h.incoming).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Transmissions: the robot answers orders, reports in when all is quiet, and every number is the engine's.

/** The first hazard decision of a seeded flight, answered with its safest option. */
function firstOrder(seed = 2013) {
  let s = ops.startOperations(maven, { seed });
  for (let i = 0; i < 10_000 && s.status === 'flying'; i++) {
    s = ops.advanceOperations(s);
    const id = s.newDecisions.find((d) => s.decisions.find((x) => x.id === d)?.kind === 'hazard');
    if (id) {
      const dec = s.decisions.find((x) => x.id === id)!;
      const r = ops.decide(s, id, dec.safestOptionId!);
      return { s: r.state, sentAt: r.receipt.sentAt, arrivesAt: r.receipt.arrivesAt!, hazardId: dec.hazardId! };
    }
  }
  throw new Error('no hazard decision in this flight');
}

describe('the robot answers orders', () => {
  it('every order it carries out: ORDER RECEIVED, sent when it lands, heard one more light time later', () => {
    const s = ops.runOperations(maven, { seed: 2013 }).state; // policy 'safe': every hazard is answered by the player
    const done = s.events.filter((e) => e.code === 'command-executed' && e.values.by === 'player');
    expect(done.length).toBeGreaterThan(0);
    const replies = robotMessages(s).filter((m) => m.kind === 'order-received');
    expect(replies.length).toBe(done.length);
    for (const e of done) {
      const m = replies.find((x) => x.values.hazardId === e.values.hazardId)!;
      expect(m.sentAt).toBe(e.t);
      expect(m.values.optionId).toBe(e.values.optionId);
      expect(m.values.commandKind).toBe('respond');
      expect(m.values.hazardType).toBe(s.hazards.find((h) => h.id === e.values.hazardId)!.type);
      // The round trip: the order left at sentAt, landed one light time later (= e.t), and the reply needs one more.
      const cmd = s.commands.find((c) => c.command.kind === 'respond' && c.command.hazardId === e.values.hazardId)!;
      expect(cmd.arrivesAt).toBeCloseTo(e.t, 12);
      expect(m.receivedAt).toBeCloseTo(newsArrival(s.env, e.t), 12);
      expect((m.receivedAt - cmd.sentAt) * DAY_S).toBeCloseTo(oneWayAt(s.env, cmd.sentAt) + oneWayAt(s.env, cmd.arrivesAt), 3);
    }
  });

  it('a power plan sent in cruise is acknowledged too', () => {
    let s = ops.startOperations(maven, { rng: () => 0.999999 });
    s = ops.advanceOperations(s, { until: 40 });
    const sent = ops.sendCommand(s, { kind: 'power-plan', plan: defaultPowerPlan(s.env) });
    expect(sent.receipt.accepted).toBe(true);
    s = ops.advanceOperations(sent.state, { until: 45 });
    const m = robotMessages(s).find((x) => x.kind === 'order-received')!;
    expect(m.values.commandKind).toBe('power-plan');
    expect(m.sentAt).toBeCloseTo(sent.receipt.arrivesAt!, 12);
  });

  it('when no order comes in time, it says what it chose itself', () => {
    const s = ops.runOperations(maven, { seed: 2013, policy: 'default' }).state;
    const missed = s.events.filter((e) => e.code === 'deadline-missed');
    expect(missed.length).toBeGreaterThan(0);
    const alone = robotMessages(s).filter((m) => m.kind === 'acted-alone');
    expect(alone.map((m) => [m.sentAt, m.values.optionId, m.values.by])).toEqual(missed.map((e) => [e.t, e.values.optionId, e.values.by]));
    expect(robotMessages(s).some((m) => m.kind === 'order-received')).toBe(false);
  });

  it('the extension order: it replies once the order reaches it, then signs off at the end', () => {
    const s = ops.runOperations(maven, { rng: () => 0.999999, extension: 'longest' }).state;
    const e = s.events.find((x) => x.code === 'extension-decided')!;
    const m = robotMessages(s).find((x) => x.kind === 'extension')!;
    expect(m.values.years).toBe(e.values.years);
    // The decision is made on Earth at e.t; the order takes one light time to reach the robot.
    expect(m.sentAt).toBeCloseTo(e.t + oneWayAt(s.env, e.t) / DAY_S, 12);
    const all = robotMessages(s);
    expect(all[all.length - 1]!.kind).toBe('signing-off');
  });

  it('ending the mission: the last word is the sign-off, once the order to stop reaches the robot', () => {
    const s = calm(); // extension policy 'end'
    const e = s.events.find((x) => x.code === 'extension-decided')!;
    const all = robotMessages(s);
    const last = all[all.length - 1]!;
    expect(last.kind).toBe('signing-off');
    expect(last.sentAt).toBeCloseTo(e.t + oneWayAt(s.env, e.t) / DAY_S, 12);
    expect(all.some((m) => m.kind === 'extension')).toBe(false);
  });

  it('a flight replayed from its seed and action log says exactly the same things', () => {
    const s = ops.runOperations(maven, { seed: 2013 }).state;
    expect(s.actions.length).toBeGreaterThan(0);
    const again = ops.replayOperations(maven, { seed: 2013 }, s.actions);
    expect(robotMessages(again)).toEqual(robotMessages(s));
  });
});

describe('the robot reports in', () => {
  const STEP = VOICE_RULES.statusEvery_days.value; // 10 days (game rule)

  it('routine status: on the grid days only, never two within the step, never in a conjunction or on a busy stretch', () => {
    const s = calm();
    const all = robotMessages(s);
    const status = all.filter((m) => m.kind === 'status');
    expect(status.length).toBeGreaterThan(10);
    for (const [i, m] of status.entries()) {
      expect(m.sentAt % STEP).toBe(0);
      if (i > 0) expect(m.sentAt - status[i - 1]!.sentAt).toBeGreaterThanOrEqual(STEP);
      expect(s.env.days[m.sentAt]!.conjunction).toBe(false);
      // An event message in the last STEP days already said the robot is alive.
      expect(all.some((x) => x.kind !== 'status' && x.sentAt > m.sentAt - STEP && x.sentAt <= m.sentAt)).toBe(false);
    }
  });

  it('status numbers are the engine’s: days to arrival, distance, fuel and data from that day', () => {
    const s = calm();
    for (const m of robotMessages(s).filter((x) => x.kind === 'status')) {
      const d = m.sentAt;
      // e.g. day 100 of MAVEN: arrival on day 307 → 207 days to go
      expect(m.values.daysToArrival).toBe(Math.max(0, s.env.arrivalDay - d));
      expect(m.values.earthDistance_m).toBe(s.env.days[d]!.earthDistance_m);
      expect(m.values.propellantLeft_kg).toBe(s.ledger[d - 1]!.propellantLeft_kg);
      expect(m.values.downlinked_bits).toBeCloseTo(s.ledger.slice(0, d).reduce((a, r) => a + r.downlinked_bits, 0), 0);
      expect(m.values.phase).toBe(s.env.days[d]!.phase);
    }
  });

  it('the arrival message carries the arrival burn: Δv and propellant', () => {
    const s = calm();
    const b = s.events.find((e) => e.code === 'burn' && e.values.kind === 'arrival')!;
    const m = robotMessages(s).find((x) => x.kind === 'arrived')!;
    expect(m.values.dv_ms).toBe(b.values.dv_ms);
    expect(m.values.propellant_kg).toBe(b.values.propellant_kg);
  });

  it('science milestones: a quarter, half, three quarters, all of the goal, each once, on the day it is crossed', () => {
    const s = calm();
    const sci = s.env.timeline.find((w) => w.phase === 'science')!;
    const goal = s.env.loads.instruments.reduce((a, i) => a + i.data_bitsPerDay, 0) * (sci.endDay - sci.startDay + 1);
    const ms = robotMessages(s).filter((m) => m.kind === 'science-milestone');
    expect(ms.length).toBeGreaterThan(0);
    const fractions = ms.map((m) => m.values.fraction!);
    expect([...new Set(fractions)]).toEqual(fractions);
    expect([...fractions].sort((a, b) => a - b)).toEqual(fractions);
    for (const m of ms) {
      expect(VOICE_RULES.scienceMilestones.value).toContain(m.values.fraction);
      const rows = s.ledger.filter((r) => r.phase !== 'extended' && r.day < m.sentAt);
      const sum = (n: number) => rows.slice(0, n).reduce((a, r) => a + r.downlinked_bits, 0);
      expect(sum(rows.length) / goal).toBeGreaterThanOrEqual(m.values.fraction! - 1e-9); // floating-point sum
      expect(sum(rows.length - 1) / goal).toBeLessThan(m.values.fraction!);
    }
  });

  it('the thresholds are labelled game rules', () => {
    expect(VOICE_RULES.statusEvery_days.isGameEstimate).toBe(true);
    expect(VOICE_RULES.scienceMilestones.isGameEstimate).toBe(true);
    expect(VOICE_RULES.feedLength.isGameEstimate).toBe(true);
  });
});

describe('transmission feed (the teletype: the robot in black, your orders in red)', () => {
  it('an order: in flight → delivered with the reply on its way → replied, with the round trip', () => {
    const o = firstOrder();
    let s = o.s;
    let feed = transmissionFeed(s);
    let mine = feed.entries.find((e) => e.from === 'earth' && e.order!.hazardId === o.hazardId)!;
    if (o.sentAt > s.t) {
      // The team is still writing it: it leaves Earth at sentAt.
      expect(mine.order!.status).toBe('queued');
      expect(mine.order!.departsIn_s).toBeCloseTo((o.sentAt - s.t) * DAY_S, 3);
      s = ops.advanceOperations(s, { until: o.sentAt + 1e-9 });
      feed = transmissionFeed(s);
      mine = feed.entries.find((e) => e.from === 'earth' && e.order!.hazardId === o.hazardId)!;
    }
    expect(mine.order!.status).toBe('in-flight');
    expect(mine.order!.arrivesIn_s).toBeCloseTo((o.arrivesAt - s.t) * DAY_S, 3);
    // Halfway out: progress ½ along Earth → robot.
    s = ops.advanceOperations(s, { until: (o.sentAt + o.arrivesAt) / 2 });
    mine = transmissionFeed(s).entries.find((e) => e.from === 'earth' && e.order!.hazardId === o.hazardId)!;
    expect(mine.order!.progress).toBeCloseTo(0.5, 6);

    s = ops.advanceOperations(s, { until: o.arrivesAt + 1e-6 });
    feed = transmissionFeed(s);
    mine = feed.entries.find((e) => e.from === 'earth' && e.order!.hazardId === o.hazardId)!;
    expect(mine.order!.status).toBe('reply-inbound');
    const replyAt = newsArrival(s.env, o.arrivesAt);
    expect(mine.order!.replyIn_s).toBeCloseTo((replyAt - s.t) * DAY_S, 3);
    expect(mine.order!.replyAt).toBeCloseTo(replyAt, 12);
    expect(mine.order!.progress).toBeLessThan(0.01); // the reply has only just left the robot
    expect(feed.entries.some((e) => e.message?.kind === 'order-received')).toBe(false); // not heard yet

    s = ops.advanceOperations(s, { until: replyAt + 1e-6 });
    feed = transmissionFeed(s);
    mine = feed.entries.find((e) => e.from === 'earth' && e.order!.hazardId === o.hazardId)!;
    expect(mine.order!.status).toBe('replied');
    const reply = feed.entries.find((e) => e.message?.kind === 'order-received')!;
    expect(reply.roundTrip_s).toBeCloseTo((reply.message!.receivedAt - o.sentAt) * DAY_S, 3);
  });

  it('entries are in the order they appear on Earth, the newest last, at most the feed length', () => {
    const s = ops.runOperations(maven, { seed: 2013, extension: 'longest' }).state;
    const { entries } = transmissionFeed(s);
    expect(entries.length).toBeLessThanOrEqual(VOICE_RULES.feedLength.value);
    const at = entries.map((e) => e.at);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(entries[entries.length - 1]!.message?.kind).toBe('signing-off');
  });

  it('a robot line shows how long it took to reach Earth', () => {
    const s = calm();
    for (const e of transmissionFeed(s).entries.filter((x) => x.from === 'robot')) expect(e.message!.delay_s).toBeCloseTo(oneWayAt(s.env, e.message!.sentAt), 6);
  });
});
