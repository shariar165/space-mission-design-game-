// Fly & Survive view model (engine: src/engine/ops/fly.ts). Everything the Signal Delay flight screen shows that the
// Operations Console view does not already give: 0–5 segment tiles, the Systems health, danger-card times and
// chips, the Coming Up ribbon, the path still ahead and the eclipse planning card. Hand calculations in comments.
import { describe, expect, it } from 'vitest';
import { craftPosition } from '../src/engine/flightMap';
import { presetDesign } from '../src/engine/missions';
import * as ops from '../src/engine/ops/index';
import { consoleView, powerPlanPreview } from '../src/engine/ops/console';
import { comingUp, eclipseCard, flyCard, flyTiles, FLY_RULES, missionProgress, outcomeIn_s, segmentsFromFraction, segmentsFromMargin, stormFront, systemsHealth, countdownAt, momentsSince } from '../src/engine/ops/fly';
import { pathAhead } from '../src/engine/flightMap';
import type { OpsState } from '../src/engine/ops/types';
import { starterDesign } from '../src/ui/starters';

const maven = presetDesign('maven');
const DAY_S = 86_400;

describe('segment rules (five-segment tiles)', () => {
  it('margin → segments: full at the top of the 10–30% band, empty below 0', () => {
    // 5 × min(1, m / 0.30), rounded, at least 1 while the margin is not negative
    expect(FLY_RULES.gaugeSegments.value).toBe(5);
    expect(FLY_RULES.powerFullMargin.value).toBe(0.3);
    expect(segmentsFromMargin(0.3)).toBe(5);
    expect(segmentsFromMargin(0.6)).toBe(5);
    expect(segmentsFromMargin(0.15)).toBe(3); // 5 × 0.5 = 2.5 → 3
    expect(segmentsFromMargin(0.1)).toBe(2); // 5 × 0.333 = 1.67 → 2
    expect(segmentsFromMargin(0.01)).toBe(1); // 0.17 → 0, but a non-negative margin keeps one segment
    expect(segmentsFromMargin(0)).toBe(1);
    expect(segmentsFromMargin(-0.01)).toBe(0);
    expect(segmentsFromMargin(Infinity)).toBe(5);
  });

  it('fraction → segments: 5 × f rounded, at least 1 while anything is left', () => {
    expect(segmentsFromFraction(1)).toBe(5);
    expect(segmentsFromFraction(0.5)).toBe(3); // 2.5 → 3
    expect(segmentsFromFraction(0.62)).toBe(3); // 3.1 → 3
    expect(segmentsFromFraction(0.05)).toBe(1); // 0.25 → 0, but something is left
    expect(segmentsFromFraction(0)).toBe(0);
    expect(segmentsFromFraction(1.4)).toBe(5);
  });
});

describe('Fly & Survive tiles', () => {
  it('power, fuel, data and systems read the console gauges and the state', () => {
    const s0 = ops.startOperations(maven, { rng: () => 0.999999 });
    const s = ops.advanceOperations(s0, { until: s0.env.arrivalDay + 60.5 });
    const v = consoleView(s);
    const t = flyTiles(s, v);
    expect(t.power.segments).toBe(segmentsFromMargin(v.gauges.power.margin));
    expect(t.power.status).toBe(v.gauges.power.status);
    expect(t.fuel.segments).toBe(segmentsFromFraction(v.gauges.fuel.fill));
    // data: science sent home against the prime goal (the Debrief's goal), in Gbit
    const d = ops.operationsDebrief(s);
    expect(t.data.sent_Gbit).toBeCloseTo(s.downlinkedPrime_bits / 1e9, 9);
    expect(t.data.goal_Gbit).toBeCloseTo(d.goal_Gbit, 9);
    expect(t.data.segments).toBe(segmentsFromFraction(t.data.sent_Gbit / t.data.goal_Gbit));
    expect(t.data.sent_Gbit).toBeGreaterThan(0); // 60 days of science
    // a healthy craft: all five systems segments
    expect(t.systems.segments).toBe(5);
    expect(t.systems.health).toBe(5);
    for (const k of ['power', 'fuel', 'data', 'systems'] as const) {
      expect(t[k].segments).toBeGreaterThanOrEqual(0);
      expect(t[k].segments).toBeLessThanOrEqual(5);
      expect(t[k].low).toBe(k !== 'data' && t[k].segments <= 1);
    }
  });

  it('in cruise nothing has been sent home yet: the data tile is empty', () => {
    const s = ops.advanceOperations(ops.startOperations(maven, { rng: () => 0.999999 }), { until: 50 });
    const t = flyTiles(s, consoleView(s));
    expect(t.data.sent_Gbit).toBe(0);
    expect(t.data.segments).toBe(0);
    expect(t.data.low).toBe(false); // an empty data tile is not an alarm
  });

  it('systems health: one segment off per wheel lost, instrument lost, safe mode, brownout streak and degraded pointing', () => {
    const s = ops.advanceOperations(ops.startOperations(maven, { rng: () => 0.999999 }), { until: 400 });
    expect(systemsHealth(s).health).toBe(5);
    // 4 wheels fitted (game estimate): one lost → 4; plus an instrument → 3
    expect(systemsHealth({ ...s, wheelsWorking: 3 }).health).toBe(4);
    expect(systemsHealth({ ...s, wheelsWorking: 3, instrumentsLost: ['maven-science-payload'] }).health).toBe(3);
    // safe mode now (pausedUntil ahead, and a safe-mode event set it)
    const safe = { ...s, pausedUntil: s.t + 3, events: [...s.events, { t: s.t, code: 'safe-mode' as const, values: { until: s.t + 3 } }] };
    expect(systemsHealth(safe).health).toBe(4);
    expect(systemsHealth(safe).safeMode).toBe(true);
    expect(systemsHealth({ ...s, brownoutStreak: 1 }).health).toBe(4);
    expect(systemsHealth({ ...s, attitude: 'degraded' }).health).toBe(4);
    // never below zero, and a lost craft has none
    expect(systemsHealth({ ...s, wheelsWorking: 0, instrumentsLost: ['a', 'b', 'c'], brownoutStreak: 2 }).health).toBe(0);
    expect(systemsHealth({ ...s, status: 'lost' }).health).toBe(0);
  });
});

describe('Fly & Survive danger card', () => {
  const opened = () => ops.advanceOperations(ops.startOperations(maven, { seed: 2013 }));

  it('times are relative to now: danger arrives, the order takes, the deadline', () => {
    const s = opened();
    const v = consoleView(s);
    const a = v.alert!;
    const c = flyCard(s, v)!;
    expect(c.onsetIn_s).toBeCloseTo(Math.max(0, a.onset - s.t) * DAY_S, 6);
    // the order leaves once the team has reacted, then crosses space: arrival − now
    expect(c.orderTakes_s).toBeCloseTo((a.arrivesIfSent - s.t) * DAY_S, 6);
    expect(c.orderTakes_s).toBeGreaterThanOrEqual(a.oneWay_s - 1e-6);
    expect(c.deadlineIn_s).toBeCloseTo(Math.max(0, a.deadline - s.t) * DAY_S, 6);
  });

  it('chips: costs are negative segment changes; the risk chip is an increase over the safest option, never negative', () => {
    const s = opened();
    const v = consoleView(s);
    const c = flyCard(s, v)!;
    expect(c.options.map((o) => o.id)).toEqual(v.alert!.options.map((o) => o.id));
    const minLevel = Math.min(...v.alert!.options.map((o) => o.riskLevel));
    for (const o of c.options) {
      const a = v.alert!.options.find((x) => x.id === o.id)!;
      expect(o.riskIncrease).toBe(a.riskLevel - minLevel);
      expect(o.riskIncrease).toBeGreaterThanOrEqual(0);
      const fuel = o.chips.find((k) => k.gauge === 'fuel');
      expect(fuel !== undefined).toBe(a.fuel_kg > 0);
      if (fuel) expect(fuel.delta).toBeLessThanOrEqual(-1);
      const data = o.chips.find((k) => k.gauge === 'data');
      expect(data !== undefined).toBe((a.cost.scienceDays?.value ?? 0) > 0);
      if (data) expect(data.delta).toBeLessThanOrEqual(-1);
      const money = o.chips.find((k) => k.gauge === 'coins');
      expect(money !== undefined).toBe(a.coins > 0);
      if (money) expect(money.delta).toBe(-a.coins);
    }
    expect(c.options.some((o) => o.riskIncrease === 0)).toBe(true);
  });

  it('after the order lands: seconds until the outcome is known (the danger strikes), then nothing', () => {
    const s = opened();
    const a = consoleView(s).alert!;
    const r = ops.decide(s, a.decisionId, a.options.find((o) => o.affordable)!.id);
    expect(outcomeIn_s(r.state, a.hazardId)).toBeUndefined(); // still on its way
    const landed = ops.advanceOperations(r.state, { until: r.receipt.arrivesAt! + 1e-6 });
    const rec = landed.hazards.find((h) => h.id === a.hazardId)!;
    if (!rec.outcomeDone) {
      // resolves at max(onset, execution): onset is later here, so the wait is (resolveAt − t) days
      expect(outcomeIn_s(landed, a.hazardId)).toBeCloseTo((rec.resolveAt! - landed.t) * DAY_S, 6);
    }
    const done = ops.advanceOperations(landed, { until: (rec.resolveAt ?? landed.t) + 0.01 });
    expect(outcomeIn_s(done, a.hazardId)).toBeUndefined();
  });

  it('no card when nothing is waiting for a decision', () => {
    const s = ops.advanceOperations(ops.startOperations(maven, { rng: () => 0.999999 }), { until: 30 });
    expect(flyCard(s, consoleView(s))).toBeUndefined();
  });
});

describe('Coming Up ribbon', () => {
  it('the next 150 days: month ticks, events with inDays and left = inDays / 150, never a surprise hazard', () => {
    const env = ops.prepareOps(maven);
    const s = ops.advanceOperations(ops.startOperations(maven, { rng: () => 0.999999, env }), { until: env.arrivalDay - 100 });
    const day = Math.floor(s.t);
    const c = comingUp(s);
    expect(c.days).toBe(FLY_RULES.comingUpWindow_days.value);
    expect(c.days).toBe(150);
    expect(c.months).toBe(5); // 150 / 30
    expect(c.ticks.map((t) => t.inDays)).toEqual([30, 60, 90, 120]);
    expect(c.ticks.map((t) => t.months)).toEqual([1, 2, 3, 4]);
    expect(c.ticks[0]!.left).toBeCloseTo(30 / 150, 12);
    // arrival in 100 days: inside the window, and flagged as a card-worthy event
    const arr = c.items.find((i) => i.kind === 'arrival')!;
    expect(arr.inDays).toBe(100);
    expect(arr.left).toBeCloseTo(100 / 150, 12);
    expect(arr.important).toBe(true);
    for (const i of c.items) {
      expect(i.inDays).toBeGreaterThan(0);
      expect(i.inDays).toBeLessThanOrEqual(150);
      expect(i.left).toBeCloseTo(i.inDays / 150, 12);
      expect(i.day).toBe(day + i.inDays);
      expect(['eclipse', 'conjunction', 'course-fix', 'arrival', 'dust-season']).toContain(i.kind);
    }
    expect(c.items.map((i) => i.inDays)).toEqual([...c.items.map((i) => i.inDays)].sort((a, b) => a - b));
  });

  it('dust-storm season: only at Mars, starting the first day Ls enters the season', () => {
    const env = ops.prepareOps(maven);
    const start = env.days.findIndex((d, i) => i > env.arrivalDay && d.ls_deg !== undefined && d.ls_deg >= 180 && (env.days[i - 1]?.ls_deg ?? 0) < 180);
    expect(start).toBeGreaterThan(env.arrivalDay);
    // MAVEN's next season starts after the prime mission (day 672): fly the longest extension to get there
    let s = ops.advanceOperations(ops.startOperations(maven, { rng: () => 0.999999, env }), { until: start - 40 });
    expect(s.status).toBe('awaiting-extension');
    const longest = s.decisions.find((d) => d.id === 'extension')!.extensionOptions!.filter((o) => o.blockedBy.length === 0).sort((a, b) => b.days - a.days)[0]!;
    s = ops.advanceOperations(ops.decide(s, 'extension', longest.id).state, { until: start - 40 });
    expect(Math.floor(s.t)).toBe(start - 40);
    const dust = comingUp(s).items.find((i) => i.kind === 'dust-season')!;
    expect(dust.day).toBe(start);
    expect(dust.important).toBe(false);
  });

  it('conjunction and eclipse seasons appear when they start inside the window', () => {
    const env = ops.prepareOps(maven);
    const w = env.conjunctions[0]!;
    const s = ops.advanceOperations(ops.startOperations(maven, { rng: () => 0.999999, env }), { until: w.startDay - 20 });
    const c = comingUp(s).items.find((i) => i.kind === 'conjunction')!;
    expect(c.day).toBe(w.startDay);
    expect(c.endDay).toBe(w.endDay);
    expect(c.important).toBe(true);
  });
});

describe('path still ahead (the dashed line)', () => {
  it('runs from the craft today to the arrival point; nothing once arrived', () => {
    const ev = ops.prepareOps(maven).ev;
    const p = pathAhead(maven, 100, ev);
    expect(p[0]).toEqual(craftPosition(maven, 100, ev));
    expect(p[p.length - 1]).toEqual(craftPosition(maven, ev.trajectory.flightDays, ev));
    expect(pathAhead(maven, ev.trajectory.flightDays + 1, ev)).toEqual([]);
  });
});

describe('eclipse planning card', () => {
  it('a few days before a season: keep warm (the plan in force) or save power (heaters turned down)', () => {
    const env = ops.prepareOps(maven);
    const season = env.eclipseSeasons.find((e) => e.startDay > env.arrivalDay)!;
    const s = ops.advanceOperations(ops.startOperations(maven, { rng: () => 0.999999, env }), { until: season.startDay - 1.5 });
    const card = eclipseCard(s)!;
    expect(card.season.startDay).toBe(season.startDay);
    expect(card.inDays).toBe(season.startDay - Math.floor(s.t));
    expect(card.inDays).toBeLessThanOrEqual(FLY_RULES.eclipseCardLead_days.value);
    const [warm, save] = card.options;
    expect(warm!.id).toBe('keep-warm');
    expect(save!.id).toBe('save-power');
    expect(warm!.preview).toEqual(powerPlanPreview(s, s.plan));
    expect(save!.plan.heaters).toBe(FLY_RULES.savePowerHeaters.value);
    expect(save!.preview.cold).toBe(true);
    // less load in the dark → the battery is drawn down less → more power segments in eclipse
    expect(save!.preview.eclipse!.depthOfDischarge).toBeLessThan(warm!.preview.eclipse!.depthOfDischarge);
    expect(save!.eclipseSegments).toBe(segmentsFromMargin(save!.preview.eclipse!.margin));
    expect(save!.eclipseSegments).toBeGreaterThanOrEqual(warm!.eclipseSegments);
    // far from any season: no card
    expect(eclipseCard(ops.advanceOperations(ops.startOperations(maven, { rng: () => 0.999999, env }), { until: 20 }))).toBeUndefined();
  });
});

describe('mission progress (the flight bar and "mission ends in")', () => {
  it('runs from 0 at launch to 1 at the end of the prime mission', () => {
    const env = ops.prepareOps(maven);
    const s0 = ops.startOperations(maven, { rng: () => 0.999999, env });
    const total = env.primeEndDay + 1; // days 0 … primeEndDay
    // launch: nothing flown, every day still ahead
    expect(missionProgress(s0)).toEqual({ fraction: 0, daysLeft: total, endDay: env.primeEndDay });
    // half way (t = total / 2): fraction 0.5, and the days not yet started are left
    const half = ops.advanceOperations(s0, { until: total / 2 });
    expect(half.t).toBeCloseTo(total / 2, 9);
    expect(missionProgress(half).fraction).toBeCloseTo(0.5, 9);
    expect(missionProgress(half).daysLeft).toBe(total - Math.floor(total / 2));
    // over: full bar, nothing left
    const done = ops.finishOperations(s0);
    expect(missionProgress(done).fraction).toBe(1);
    expect(missionProgress(done).daysLeft).toBe(0);
  });

  it('in an extension the end moves to the extension’s last day', () => {
    const { state } = ops.runOperations(maven, { rng: () => 0.999999, extension: 'shortest' });
    const ext = state.extension!;
    expect(ext).toBeDefined();
    // mid-extension: rebuild the flight to the middle of it
    const s = ops.replayOperations(maven, { rng: () => 0.999999 }, state.actions, (ext.startDay + ext.endDay) / 2);
    const p = missionProgress(s);
    expect(p.endDay).toBe(ext.endDay);
    expect(p.daysLeft).toBe(ext.endDay + 1 - Math.floor(s.t));
    expect(p.fraction).toBeCloseTo(s.t / (ext.endDay + 1), 9);
  });
});

describe('finishOperations (the robot flies the rest: the flight always reaches the report)', () => {
  it('from a decision in mid-flight it runs to the end, deterministically', () => {
    // A seeded mission with real bad luck, stopped at its first hazard decision.
    let s = ops.startOperations(maven, { seed: 2013 });
    while (s.status === 'flying' && s.newDecisions.length === 0) s = ops.advanceOperations(s);
    const a = ops.finishOperations(s);
    const b = ops.finishOperations(s);
    expect(['complete', 'lost']).toContain(a.status);
    expect(b.status).toBe(a.status);
    expect(b.t).toBe(a.t);
    expect(b.events.length).toBe(a.events.length);
    // the input state is never changed
    expect(s.status).not.toBe('complete');
    // every open hazard was left to the craft (standing order or fault protection), none answered by the player
    expect(a.hazards.every((h) => h.choice === undefined || h.choice.by !== 'player')).toBe(true);
  });

  it('ends the mission at the extension decision instead of flying more years', () => {
    let s = ops.startOperations(maven, { rng: () => 0.999999 });
    while (s.status === 'flying') s = ops.advanceOperations(s);
    expect(s.status).toBe('awaiting-extension');
    const done = ops.finishOperations(s);
    expect(done.status).toBe('complete');
    expect(done.extension).toBeUndefined();
    expect(done.t).toBe(s.t); // no extra days flown
  });

  it('a finished mission is returned as it is', () => {
    const { state } = ops.runOperations(maven, { rng: () => 0.999999 });
    expect(ops.finishOperations(state).status).toBe(state.status);
    expect(ops.finishOperations(state).t).toBe(state.t);
  });
});

describe('solar storm front (the wave from the Sun on the map)', () => {
  // Run the clock to a time, stopping at every new decision on the way and leaving it open (the robot's default).
  const to = (s: OpsState, t: number) => {
    let x = s;
    for (let i = 0; i < 1000 && x.t < t - 1e-9 && x.status === 'flying'; i++) x = ops.advanceOperations(x, { until: t });
    return x;
  };
  const cases = [
    // Seed 4 draws a storm on both flights (hazards.json solar-storm: seen 1 day before it hits, lasts 3 days).
    { name: 'Moon', design: starterDesign('moon', '2026-10-04'), seed: 4 },
    { name: 'Mars (MAVEN)', design: maven, seed: 4 },
  ];
  for (const c of cases) {
    const first = ops.runOperations(c.design, { seed: c.seed }).state.hazards.find((h) => h.type === 'solar-storm')!;

    it(`${c.name}: nothing before the eruption is seen`, () => {
      expect(first).toBeDefined();
      const s = to(ops.startOperations(c.design, { seed: c.seed }), first.knownAt - 0.5);
      const f = stormFront(s);
      expect(f === undefined || f.hazardId !== first.id).toBe(true);
    });

    it(`${c.name}: the wave leaves the Sun when the eruption is seen and reaches the craft at onset`, () => {
      const lead = first.onset - first.knownAt; // warningLead_days = 1
      expect(lead).toBeCloseTo(1, 9);
      let s = to(ops.startOperations(c.design, { seed: c.seed }), first.knownAt);
      let f = stormFront(s)!;
      expect(f.hazardId).toBe(first.id);
      expect(f.phase).toBe('coming');
      expect(f.progress).toBeCloseTo((s.t - first.knownAt) / lead, 9); // 0 at the eruption
      expect(f.hitsIn_s).toBeCloseTo((first.onset - s.t) * DAY_S, 3); // 1 day = 86,400 s
      // halfway: progress (t − knownAt) / (onset − knownAt) = 0.5, and the hit is 12 h away
      s = to(s, first.knownAt + lead / 2);
      f = stormFront(s)!;
      expect(f.phase).toBe('coming');
      expect(f.progress).toBeCloseTo(0.5, 6);
      expect(f.hitsIn_s).toBeCloseTo(43_200, 0);
    });

    it(`${c.name}: hitting from onset until the storm ends, then gone`, () => {
      let s = to(ops.startOperations(c.design, { seed: c.seed }), first.onset + 0.1);
      if (s.status !== 'flying') return; // a lost craft has nothing left to hit
      let f: ReturnType<typeof stormFront> = stormFront(s)!;
      expect(f!.hazardId).toBe(first.id);
      expect(f!.phase).toBe('hitting');
      expect(f!.progress).toBe(1);
      expect(f!.hitsIn_s).toBe(0);
      s = to(s, first.endsAt + 0.01);
      f = stormFront(s);
      expect(f === undefined || f.hazardId !== first.id).toBe(true);
    });
  }

  it('the drawn wedge is a game estimate (CMEs are tens of degrees wide)', () => {
    expect(FLY_RULES.cmeWidth_deg.value).toBe(60);
    expect(FLY_RULES.cmeWidth_deg.isGameEstimate).toBe(true);
  });
});

describe('launch countdown (Fly & Survive opens with T−5 … LIFTOFF)', () => {
  it('counts whole seconds down from FLY_RULES.countdownFrom_s, then lifts off, then is done', () => {
    const from = FLY_RULES.countdownFrom_s.value; // 5
    const hold = FLY_RULES.liftoffHold_s.value; // 1.6
    expect(countdownAt(0)).toEqual({ count: from, liftoff: false, done: false });
    // 0.4 s in: still showing 5 (ceil(5 − 0.4) = 5); 1.0 s in: 4
    expect(countdownAt(0.4).count).toBe(5);
    expect(countdownAt(1).count).toBe(4);
    expect(countdownAt(4.99).count).toBe(1);
    expect(countdownAt(from)).toEqual({ count: 0, liftoff: true, done: false });
    expect(countdownAt(from + hold - 0.01).done).toBe(false);
    expect(countdownAt(from + hold).done).toBe(true);
    expect(countdownAt(-1).count).toBe(from); // never above the start
  });
});

describe('moments (what the flight screen celebrates)', () => {
  it('a calm MAVEN flight: launch on day 0, then the arrival burn at Mars', () => {
    const s0 = ops.startOperations(maven, { rng: () => 0.999999 });
    const s = ops.runOperations(maven, { rng: () => 0.999999 }).state;
    const m = momentsSince(s, 0);
    expect(m.map((x) => x.kind)).toEqual(['launch', 'arrived']);
    expect(m[0]!.t).toBe(0);
    // the arrival burn day: env.arrivalDay (307 for MAVEN in this model)
    expect(m[1]!.t).toBeCloseTo(s.env.arrivalDay, 0);
    // nothing new since the last event
    expect(momentsSince(s, s.events.length)).toEqual([]);
    expect(momentsSince(s0, 0)).toEqual([]);
  });

  it('a solar storm on the craft is a moment; other hazards are left to their cards', () => {
    const s = ops.runOperations(maven, { seed: 4 }).state;
    const storms = s.hazards.filter((h) => h.type === 'solar-storm' && h.onset <= s.t);
    const hits = momentsSince(s, 0).filter((x) => x.kind === 'storm-hit');
    expect(hits.length).toBe(storms.length);
    for (const h of hits) expect(storms.some((x) => Math.abs(x.onset - h.t) < 1e-9)).toBe(true);
  });

  it('a launch failure is its own moment', () => {
    const s = ops.runOperations(maven, { rng: () => 0 }).state;
    expect(momentsSince(s, 0).map((x) => x.kind)).toEqual(['launch-failed']);
  });
});
