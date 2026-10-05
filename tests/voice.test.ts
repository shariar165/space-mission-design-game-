// The robot's voice (engine: src/engine/ops/voice.ts). The craft talks about what happens to it, and every message
// reaches Earth one light time later: t_arrive = t_sent + d(t_sent) / c (spec: Mission operations, light time).
// Messages are data (a kind, a time, values); the words live in the UI (sdWords ROBOT_VOICE).
import { describe, expect, it } from 'vitest';
import { presetDesign } from '../src/engine/missions';
import * as ops from '../src/engine/ops/index';
import { oneWayAt } from '../src/engine/ops/commands';
import { heardMessages, robotMessages, VOICE_RULES } from '../src/engine/ops/voice';

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
      expect(m.arrivesAt).toBeCloseTo(m.sentAt + oneWay / DAY_S, 12);
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

  it('a brownout streak is one message, not one a day', () => {
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
    const mid = m.sentAt + (m.arrivesAt - m.sentAt) / 2;
    let s = ops.startOperations(maven, { rng: () => 0.999999 });
    for (let i = 0; i < 1000 && s.t < mid - 1e-12 && s.status === 'flying'; i++) s = ops.advanceOperations(s, { until: mid });
    let h = heardMessages(s);
    expect(h.heard.some((x) => x.kind === 'science' && x.sentAt === m.sentAt)).toBe(false);
    expect(h.incoming).toBeDefined();
    expect(h.incoming!.inFlight_s).toBeCloseTo((m.arrivesAt - s.t) * DAY_S, 3);
    s = ops.advanceOperations(s, { until: m.arrivesAt + 1e-6 });
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
