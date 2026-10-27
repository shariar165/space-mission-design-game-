// The robot's voice (spec: UI rules 32, "the robot talks"). The craft reports what happens to it in the first person,
// and like every downlink its message reaches Earth one light time after it is sent:
// t_received = t_sent + d(t_sent) / c (commands.ts newsArrival). Messages are data: a kind, the craft's time, values
// (SI numbers and ids). The words are the UI's (sdWords VOICE). Everything here is a pure function of the state, so
// a flight's messages follow from (design, seed, action log) like the rest of the mission.
import { gameEstimate, type Sourced } from '../types';
import { END_MISSION } from './extension';
import { newsArrival, oneWayAt } from './commands';
import { hasTargets } from './observe';
import type { OpsEvent, OpsPhase, OpsState } from './types';

export const VOICE_RULES = {
  lastWordsHistory: gameEstimate(
    'Opportunity’s last data, sent on June 10, 2018 during a planet-wide dust storm, showed low power and a dark sky. A reporter put it as “my battery is low and it’s getting dark”, and the line became famous. NASA ended the mission on February 13, 2019.',
    '',
    'Summary from general knowledge; to verify against NASA source',
    'https://science.nasa.gov/mission/mer-opportunity/',
  ),
  statusEvery_days: gameEstimate(
    10,
    'days',
    'Game rule (robot transmissions): a routine status report at most once every 10 mission days, on days 10, 20, 30 …, and only when nothing else was said in the 10 days before',
  ),
  scienceMilestones: gameEstimate(
    [0.25, 0.5, 0.75, 1],
    'fraction of the science goal',
    'Game rule (robot transmissions): the robot reports when the data sent home passes a quarter, half, three quarters and all of the prime-mission science goal',
  ),
  feedLength: gameEstimate(30, 'messages', 'Game rule (Fly & Survive teletype): the transmissions log keeps the last 30 lines'),
} satisfies Record<string, Sourced<unknown>>;

export type VoiceKind =
  | 'launch'
  | 'launch-failed'
  | 'halfway'
  | 'arrived'
  | 'science'
  | 'heading-home'
  | 'bonus-time'
  | 'dark'
  | 'conjunction'
  | 'conjunction-end'
  | 'hit'
  | 'saved'
  | 'hurt'
  | 'instrument-lost'
  | 'safe-mode'
  | 'brownout'
  | 'wheel-spare'
  | 'out-of-fuel'
  | 'prime-complete'
  | 'last-words'
  | 'order-received'
  | 'acted-alone'
  | 'order-too-late'
  | 'science-milestone'
  | 'extension'
  | 'signing-off'
  | 'status'
  | 'targets'
  | 'observing'
  | 'observe-refused'
  | 'image-sent'
  | 'far-side'
  | 'link-back';

export interface RobotMessage {
  kind: VoiceKind;
  /** Mission time the craft sent it (days). */
  sentAt: number;
  /** Mission time it reaches Earth (days): sentAt + one-way light time. */
  receivedAt: number;
  /** One-way light time on the way (s). */
  delay_s: number;
  /** How many messages of this kind came before (0, 1, 2 …): the UI picks its words by it. */
  seq: number;
  values: MessageValues;
}

/** Ids and SI numbers; the UI formats them. */
export interface MessageValues {
  hazardId?: string;
  hazardType?: string;
  instrumentId?: string;
  streak?: number;
  /** An order the robot carried out (or chose itself), and who chose it. */
  optionId?: string;
  commandKind?: 'respond' | 'power-plan' | 'standing-orders' | 'observe';
  /** Science targets: the target, how long the observation lasts (days), why an order was refused. */
  targetId?: string;
  days?: number;
  reason?: string;
  commandId?: number;
  by?: string;
  /** Science milestone: the share of the prime science goal now sent home. */
  fraction?: number;
  /** Extension: years granted. */
  years?: number;
  /** Arrival burn. */
  dv_ms?: number;
  propellant_kg?: number;
  /** Eclipse season: its longest eclipse (s). */
  longestEclipse_s?: number;
  /** Behind the Moon: the longest loss of signal per orbit and the orbit period (s); how long an order waited (s). */
  lost_s?: number;
  period_s?: number;
  waited_s?: number;
  /** Routine status. */
  phase?: OpsPhase;
  daysToArrival?: number;
  earthDistance_m?: number;
  propellantLeft_kg?: number;
  downlinked_bits?: number;
  powerMargin?: number;
}

const PHASE_KIND: Partial<Record<string, VoiceKind>> = { arrival: 'arrived', science: 'science', return: 'heading-home', extended: 'bonus-time' };

type Raw = { kind: VoiceKind; sentAt: number; values: MessageValues };

/** The kind (and values) a craft-side event gives, or nothing for events the robot keeps to itself. */
function voiceOf(e: OpsEvent, s: OpsState): { kind: VoiceKind; values: MessageValues } | undefined {
  const v = e.values;
  const type = (id: unknown) => s.hazards.find((h) => h.id === id)?.type;
  const hazard = (id: unknown) => {
    const t = type(id);
    return { hazardId: String(id), ...(t ? { hazardType: t } : {}) };
  };
  switch (e.code) {
    case 'launch':
      return { kind: 'launch', values: {} };
    case 'launch-failed':
      return { kind: 'launch-failed', values: {} };
    case 'phase-start': {
      const kind = PHASE_KIND[String(v.phase)];
      // At Mars the science phase opens with the robot asking what to look at (spec: UI rule 39).
      if (kind === 'science' && hasTargets(s.env)) return { kind: 'targets', values: {} };
      if (kind !== 'arrived') return kind ? { kind, values: {} } : undefined;
      // The arrival message carries the arrival burn made that day (if any).
      const b = s.events.find((x) => x.code === 'burn' && x.values.kind === 'arrival' && Math.floor(x.t) === Math.floor(e.t));
      return { kind, values: b ? { dv_ms: Number(b.values.dv_ms), propellant_kg: Number(b.values.propellant_kg) } : {} };
    }
    case 'eclipse-season-start':
      return { kind: 'dark', values: { longestEclipse_s: Number(v.longestEclipse_s) } };
    case 'conjunction-start':
      return { kind: 'conjunction', values: {} };
    case 'conjunction-end':
      return { kind: 'conjunction-end', values: {} };
    case 'hazard-onset': {
      const t = type(v.hazardId);
      // The insertion anomaly is judged on the arrival burn: the arrival message covers it.
      return t && t !== 'insertion-anomaly' ? { kind: 'hit', values: { hazardId: String(v.hazardId), hazardType: t } } : undefined;
    }
    case 'response-outcome':
      return { kind: v.bad ? 'hurt' : 'saved', values: hazard(v.hazardId) };
    case 'command-executed': {
      // Orders from Earth only: the robot's own choices are told at the missed deadline.
      if (v.commandId !== undefined) return { kind: 'order-received', values: { commandId: Number(v.commandId), commandKind: v.kind === 'standing-orders' ? 'standing-orders' : 'power-plan' } };
      if (v.by !== 'player') return undefined;
      const cmd = s.commands.find((c) => c.command.kind === 'respond' && c.command.hazardId === v.hazardId && c.status === 'executed');
      return { kind: 'order-received', values: { ...hazard(v.hazardId), optionId: String(v.optionId), commandKind: 'respond', ...(cmd ? { commandId: cmd.id } : {}) } };
    }
    case 'deadline-missed':
      return { kind: 'acted-alone', values: { ...hazard(v.hazardId), optionId: String(v.optionId), by: String(v.by) } };
    case 'command-too-late':
      return { kind: 'order-too-late', values: { ...hazard(v.hazardId), commandId: Number(v.commandId) } };
    case 'instrument-lost':
      return { kind: 'instrument-lost', values: { instrumentId: String(v.instrumentId) } };
    case 'safe-mode':
      return { kind: 'safe-mode', values: {} };
    case 'brownout':
      // Low battery: one message when the brownout starts, not one a day.
      return Number(v.streak) === 1 ? { kind: 'brownout', values: { streak: 1 } } : undefined;
    case 'wheel-spare-took-over':
      return { kind: 'wheel-spare', values: {} };
    case 'out-of-propellant':
      return { kind: 'out-of-fuel', values: {} };
    case 'prime-complete':
      return { kind: 'prime-complete', values: {} };
    case 'observe-start':
      return { kind: 'observing', values: { commandId: Number(v.commandId), commandKind: 'observe', targetId: String(v.targetId), days: Number(v.days) } };
    case 'observe-refused':
      return { kind: 'observe-refused', values: { commandId: Number(v.commandId), commandKind: 'observe', targetId: String(v.targetId), reason: String(v.reason) } };
    case 'image-sent':
      return { kind: 'image-sent', values: { targetId: String(v.targetId) } };
    case 'far-side':
      return { kind: 'far-side', values: { lost_s: Number(v.lost_s), period_s: Number(v.period_s) } };
    case 'link-back':
      return { kind: 'link-back', values: { commandId: Number(v.commandId), waited_s: Number(v.waited_s) } };
    default:
      return undefined;
  }
}

/** Ground decisions the robot answers once they reach it: the extension, and the order to end the mission. */
function groundOrders(s: OpsState): Raw[] {
  const out: Raw[] = [];
  const reach = (t: number) => t + oneWayAt(s.env, t) / 86_400;
  const decided = s.events.find((e) => e.code === 'extension-decided');
  if (decided && decided.values.optionId !== END_MISSION) out.push({ kind: 'extension', sentAt: reach(decided.t), values: { years: Number(decided.values.years) } });
  if (s.status === 'complete') {
    const done = s.events.find((e) => e.code === 'mission-complete');
    if (done) out.push({ kind: 'signing-off', sentAt: decided && decided.values.optionId === END_MISSION ? reach(decided.t) : done.t, values: {} });
  }
  return out;
}

/** The prime-mission science goal (bits): Σ instrument data/day × planned science days (as primeScienceFraction). */
function scienceGoal_bits(s: OpsState): number {
  const sci = s.env.timeline.find((w) => w.phase === 'science');
  if (!sci) return 0;
  return s.env.loads.instruments.reduce((a, i) => a + i.data_bitsPerDay, 0) * (sci.endDay - sci.startDay + 1);
}

/** Science milestones from the daily ledger: sent at the end of the day the downlinked total crosses each share. */
function milestones(s: OpsState): Raw[] {
  const goal = scienceGoal_bits(s);
  // At Mars the pictures are the science: each one says so when it is sent (image-sent).
  if (goal <= 0 || hasTargets(s.env)) return [];
  const out: Raw[] = [];
  const marks = VOICE_RULES.scienceMilestones.value;
  let sum = 0;
  let next = 0;
  for (const r of s.ledger) {
    if (r.phase === 'extended' || next >= marks.length) break;
    sum += r.downlinked_bits;
    while (next < marks.length && sum / goal >= marks[next]! - 1e-12) {
      out.push({ kind: 'science-milestone', sentAt: r.day + 1, values: { fraction: marks[next]! } });
      next++;
    }
  }
  return out;
}

/**
 * Routine status: on days 10, 20, 30 … (VOICE_RULES.statusEvery_days) while the craft flies, out of a conjunction,
 * and only when nothing else was said in the window before (event messages always come; status fills the quiet).
 * Its numbers are that day's: from the environment and the ledger of the days already flown.
 */
function statuses(s: OpsState, events: Raw[]): Raw[] {
  const step = VOICE_RULES.statusEvery_days.value;
  const env = s.env;
  const out: Raw[] = [];
  const end = s.status === 'lost' ? (s.failureT ?? 0) : (s.events.find((e) => e.code === 'mission-complete')?.t ?? Infinity);
  const flownDays = s.ledger.length;
  let downlinked = 0;
  let row = 0;
  for (let d = step; d <= flownDays && d < end && d <= s.t + 1e-9; d += step) {
    while (row < d && row < flownDays) downlinked += s.ledger[row++]!.downlinked_bits;
    const e = env.days[d];
    if (!e || e.conjunction) continue;
    if (s.status === 'awaiting-extension' && d > env.primeEndDay) continue;
    if (events.some((m) => m.sentAt > d - step && m.sentAt <= d)) continue;
    const r = s.ledger[d - 1]!;
    const demand = r.demand_W.bus + r.demand_W.heaters + r.demand_W.instruments + r.demand_W.radio;
    out.push({
      kind: 'status',
      sentAt: d,
      values: {
        phase: e.phase,
        daysToArrival: Math.max(0, env.arrivalDay - d),
        earthDistance_m: e.earthDistance_m,
        propellantLeft_kg: r.propellantLeft_kg,
        downlinked_bits: downlinked,
        ...(demand > 0 ? { powerMargin: (r.available_W - demand) / demand } : {}),
      },
    });
  }
  return out;
}

/** Everything the craft has said so far, in time order (sent up to now; a finished flight has said it all). */
export function robotMessages(s: OpsState): RobotMessage[] {
  const env = s.env;
  const over = s.status === 'complete' || s.status === 'lost' || s.status === 'not-launched';
  const raw: Raw[] = [];
  const launchFailed = s.events.some((e) => e.code === 'launch-failed');
  for (const e of s.events) {
    if (e.t > s.t + 1e-9) continue;
    const m = voiceOf(e, s);
    if (m) raw.push({ ...m, sentAt: e.t });
    if (e.code === 'craft-lost' && !launchFailed) raw.push({ kind: 'last-words', sentAt: e.t, values: {} });
  }
  // Halfway through the cruise: the middle of launch → arrival.
  const half = env.arrivalDay / 2;
  if (!launchFailed && half > 0 && s.t >= half && !(s.status === 'lost' && (s.failureT ?? Infinity) < half)) raw.push({ kind: 'halfway', sentAt: half, values: {} });
  if (!launchFailed) raw.push(...milestones(s), ...groundOrders(s).filter((m) => over || m.sentAt <= s.t + 1e-9));
  if (!launchFailed) raw.push(...statuses(s, raw));
  raw.sort((a, b) => a.sentAt - b.sentAt || order(a.kind) - order(b.kind));
  const seen: Partial<Record<VoiceKind, number>> = {};
  return raw.map((m) => {
    const seq = seen[m.kind] ?? 0;
    seen[m.kind] = seq + 1;
    return { kind: m.kind, sentAt: m.sentAt, receivedAt: newsArrival(env, m.sentAt), delay_s: oneWayAt(env, m.sentAt), seq, values: m.values };
  });
}

/** Same-day messages: last words and the sign-off always come last. */
const order = (k: VoiceKind) => (k === 'last-words' || k === 'signing-off' ? 1 : 0);

export interface HeardMessages {
  /** Messages that have reached Earth, oldest first. */
  heard: RobotMessage[];
  latest?: RobotMessage;
  /** The next message still crossing space: seconds until it arrives. */
  incoming?: { inFlight_s: number };
}

/** What Earth has received by now. A finished flight has heard everything. */
export function heardMessages(s: OpsState, all = robotMessages(s)): HeardMessages {
  const over = s.status === 'complete' || s.status === 'lost' || s.status === 'not-launched';
  const heard = over ? all : all.filter((m) => m.receivedAt <= s.t + 1e-12);
  const next = over ? undefined : all.find((m) => m.receivedAt > s.t + 1e-12);
  const latest = heard[heard.length - 1];
  return { heard, ...(latest ? { latest } : {}), ...(next ? { incoming: { inFlight_s: (next.receivedAt - s.t) * 86_400 } } : {}) };
}

// ---------------------------------------------------------------------------
// The transmissions teletype: the robot's heard messages and the player's orders, as Earth sees them.

export interface OrderLine {
  kind: 'respond' | 'power-plan' | 'standing-orders' | 'extension' | 'observe';
  sentAt: number;
  /** When it reaches the robot (days). */
  arrivesAt: number;
  hazardId?: string;
  hazardType?: string;
  optionId?: string;
  years?: number;
  /** OBSERVE orders: the target. */
  targetId?: string;
  /**
   * queued (the team is still writing it) → in-flight → reply-inbound (the robot acted; its reply is on the way) →
   * replied; or too-late (it landed after the robot had already acted).
   */
  status: 'queued' | 'in-flight' | 'reply-inbound' | 'replied' | 'too-late';
  /** Seconds until the order leaves Earth (queued). */
  departsIn_s?: number;
  /** Seconds until the order reaches the robot (in flight). */
  arrivesIn_s?: number;
  /** Seconds until the robot's reply reaches Earth (reply inbound). */
  replyIn_s?: number;
  /** When the reply reaches Earth (days): one light time after the order lands. */
  replyAt: number;
  /** 0–1 along the current leg: Earth → robot while in flight, robot → Earth while the reply is inbound. */
  progress: number;
}

export interface FeedEntry {
  from: 'robot' | 'earth';
  /** Mission time it appears on Earth: heard (robot) or sent (earth). */
  at: number;
  message?: RobotMessage;
  order?: OrderLine;
  /** A reply to an order: seconds from the order leaving Earth to the reply arriving. */
  roundTrip_s?: number;
}

export interface TransmissionFeed {
  /** Oldest first; the newest is last. At most VOICE_RULES.feedLength. */
  entries: FeedEntry[];
}

/** The teletype of transmissions (design: TELETYPE 02 · ‹NAME› ⇄ EARTH). */
export function transmissionFeed(s: OpsState): TransmissionFeed {
  const DAY = 86_400;
  const all = robotMessages(s);
  const { heard } = heardMessages(s, all);
  const replyTo = (o: { kind: OrderLine['kind']; hazardId?: string; commandId?: number }) =>
    all.find((m) =>
      o.kind === 'extension'
        ? m.kind === 'extension'
        : o.kind === 'respond'
          ? (m.kind === 'order-received' || m.kind === 'order-too-late') && m.values.hazardId === o.hazardId
          : o.kind === 'observe'
            ? (m.kind === 'observing' || m.kind === 'observe-refused') && m.values.commandId === o.commandId
            : m.kind === 'order-received' && m.values.commandId === o.commandId,
    );
  const entries: FeedEntry[] = [];
  const orders: { line: Omit<OrderLine, 'status' | 'replyAt' | 'progress'>; commandId?: number; tooLate?: boolean }[] = [];
  for (const c of s.commands) {
    const cmd = c.command;
    const type = cmd.kind === 'respond' ? s.hazards.find((h) => h.id === cmd.hazardId)?.type : undefined;
    orders.push({
      line: {
        kind: cmd.kind,
        sentAt: c.sentAt,
        arrivesAt: c.arrivesAt,
        ...(cmd.kind === 'respond' ? { hazardId: cmd.hazardId, optionId: cmd.optionId, ...(type ? { hazardType: type } : {}) } : {}),
        ...(cmd.kind === 'observe' ? { targetId: cmd.targetId } : {}),
      },
      commandId: c.id,
      tooLate: c.status === 'too-late',
    });
  }
  const decided = s.events.find((e) => e.code === 'extension-decided' && e.values.optionId !== END_MISSION);
  if (decided) orders.push({ line: { kind: 'extension', sentAt: decided.t, arrivesAt: decided.t + oneWayAt(s.env, decided.t) / DAY, years: Number(decided.values.years) } });

  const replies = new Map<RobotMessage, number>();
  for (const o of orders) {
    const reply = replyTo({ kind: o.line.kind, ...(o.line.hazardId ? { hazardId: o.line.hazardId } : {}), ...(o.commandId !== undefined ? { commandId: o.commandId } : {}) });
    const landed = s.t >= o.line.arrivesAt - 1e-12;
    const replied = reply !== undefined && heard.includes(reply);
    const status: OrderLine['status'] = s.t < o.line.sentAt - 1e-12 ? 'queued' : !landed ? 'in-flight' : replied ? (o.tooLate ? 'too-late' : 'replied') : 'reply-inbound';
    const replyAt = reply?.receivedAt ?? newsArrival(s.env, o.line.arrivesAt);
    const leg = (a: number, b: number) => (b > a ? Math.min(1, Math.max(0, (s.t - a) / (b - a))) : 1);
    const progress = status === 'queued' ? 0 : status === 'in-flight' ? leg(o.line.sentAt, o.line.arrivesAt) : status === 'reply-inbound' ? leg(o.line.arrivesAt, replyAt) : 1;
    entries.push({
      from: 'earth',
      at: o.line.sentAt,
      order: {
        ...o.line,
        status,
        replyAt,
        progress,
        ...(status === 'queued' ? { departsIn_s: (o.line.sentAt - s.t) * DAY } : {}),
        ...(status === 'in-flight' ? { arrivesIn_s: (o.line.arrivesAt - s.t) * DAY } : {}),
        ...(status === 'reply-inbound' ? { replyIn_s: Math.max(0, replyAt - s.t) * DAY } : {}),
      },
    });
    if (reply) replies.set(reply, (reply.receivedAt - o.line.sentAt) * DAY);
  }
  for (const m of heard) entries.push({ from: 'robot', at: m.receivedAt, message: m, ...(replies.has(m) ? { roundTrip_s: replies.get(m)! } : {}) });
  entries.sort((a, b) => a.at - b.at || (a.from === b.from ? 0 : a.from === 'earth' ? -1 : 1));
  return { entries: entries.slice(-VOICE_RULES.feedLength.value) };
}
