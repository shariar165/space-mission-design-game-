// The robot's voice (spec: UI rules, "the robot talks"). The craft reports what happens to it in the first person,
// and like every downlink its message reaches Earth one light time after it is sent:
// t_arrive = t_sent + d(t_sent) / c (commands.ts newsArrival). Messages are data: a kind, the craft's time, values.
// The words are the UI's (sdWords ROBOT_VOICE).
import { gameEstimate, type Sourced } from '../types';
import { newsArrival, oneWayAt } from './commands';
import type { OpsEvent, OpsState } from './types';

export const VOICE_RULES = {
  lastWordsHistory: gameEstimate(
    'Opportunity’s last data, sent on June 10, 2018 during a planet-wide dust storm, showed low power and a dark sky. A reporter put it as “my battery is low and it’s getting dark”, and the line became famous. NASA ended the mission on February 13, 2019.',
    '',
    'Summary from general knowledge; to verify against NASA source',
    'https://science.nasa.gov/mission/mer-opportunity/',
  ),
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
  | 'last-words';

export interface RobotMessage {
  kind: VoiceKind;
  /** Mission time the craft sent it (days). */
  sentAt: number;
  /** Mission time it reaches Earth (days). */
  arrivesAt: number;
  /** One-way light time on the way (s). */
  delay_s: number;
  /** How many messages of this kind came before (0, 1, 2 …): the UI picks its words by it. */
  seq: number;
  values: { hazardId?: string; hazardType?: string; instrumentId?: string; streak?: number };
}

const PHASE_KIND: Partial<Record<string, VoiceKind>> = { arrival: 'arrived', science: 'science', return: 'heading-home', extended: 'bonus-time' };

/** The kind (and values) a craft-side event gives, or nothing for events the robot keeps to itself. */
function voiceOf(e: OpsEvent, s: OpsState): { kind: VoiceKind; values: RobotMessage['values'] } | undefined {
  const v = e.values;
  const type = (id: unknown) => s.hazards.find((h) => h.id === id)?.type;
  switch (e.code) {
    case 'launch':
      return { kind: 'launch', values: {} };
    case 'launch-failed':
      return { kind: 'launch-failed', values: {} };
    case 'phase-start': {
      const kind = PHASE_KIND[String(v.phase)];
      return kind ? { kind, values: {} } : undefined;
    }
    case 'eclipse-season-start':
      return { kind: 'dark', values: {} };
    case 'conjunction-start':
      return { kind: 'conjunction', values: {} };
    case 'conjunction-end':
      return { kind: 'conjunction-end', values: {} };
    case 'hazard-onset': {
      const t = type(v.hazardId);
      // The insertion anomaly is judged on the arrival burn: the arrival message covers it.
      return t && t !== 'insertion-anomaly' ? { kind: 'hit', values: { hazardId: String(v.hazardId), hazardType: t } } : undefined;
    }
    case 'response-outcome': {
      const t = type(v.hazardId);
      return { kind: v.bad ? 'hurt' : 'saved', values: { hazardId: String(v.hazardId), ...(t ? { hazardType: t } : {}) } };
    }
    case 'instrument-lost':
      return { kind: 'instrument-lost', values: { instrumentId: String(v.instrumentId) } };
    case 'safe-mode':
      return { kind: 'safe-mode', values: {} };
    case 'brownout':
      // One message when the brownout starts, not one a day.
      return Number(v.streak) === 1 ? { kind: 'brownout', values: { streak: 1 } } : undefined;
    case 'wheel-spare-took-over':
      return { kind: 'wheel-spare', values: {} };
    case 'out-of-propellant':
      return { kind: 'out-of-fuel', values: {} };
    case 'prime-complete':
      return { kind: 'prime-complete', values: {} };
    default:
      return undefined;
  }
}

/** Everything the craft has said so far, in time order (sent up to now). */
export function robotMessages(s: OpsState): RobotMessage[] {
  const env = s.env;
  const raw: { kind: VoiceKind; sentAt: number; values: RobotMessage['values'] }[] = [];
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
  raw.sort((a, b) => a.sentAt - b.sentAt || order(a.kind) - order(b.kind));
  const seen: Partial<Record<VoiceKind, number>> = {};
  return raw.map((m) => {
    const seq = seen[m.kind] ?? 0;
    seen[m.kind] = seq + 1;
    return { kind: m.kind, sentAt: m.sentAt, arrivesAt: newsArrival(env, m.sentAt), delay_s: oneWayAt(env, m.sentAt), seq, values: m.values };
  });
}

/** Same-day messages: last words always come last. */
const order = (k: VoiceKind) => (k === 'last-words' ? 1 : 0);

export interface HeardMessages {
  /** Messages that have reached Earth, oldest first. */
  heard: RobotMessage[];
  latest?: RobotMessage;
  /** The next message still crossing space: seconds until it arrives. */
  incoming?: { inFlight_s: number };
}

/** What Earth has received by now. A finished flight has heard everything. */
export function heardMessages(s: OpsState): HeardMessages {
  const all = robotMessages(s);
  const over = s.status === 'complete' || s.status === 'lost' || s.status === 'not-launched';
  const heard = over ? all : all.filter((m) => m.arrivesAt <= s.t + 1e-12);
  const next = over ? undefined : all.find((m) => m.arrivesAt > s.t + 1e-12);
  const latest = heard[heard.length - 1];
  return { heard, ...(latest ? { latest } : {}), ...(next ? { incoming: { inFlight_s: (next.arrivesAt - s.t) * 86_400 } } : {}) };
}
