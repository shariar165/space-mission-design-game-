// Command queue with real one-way light delay (spec: Mission operations, "Commands and light time").
// t_arrive = t_send + d(t_send)/c. Nothing is instant, and nothing can be sent in a conjunction moratorium.
import type { OpsEnvironment } from './types';

/** One-way light time (s) at mission time t (days), linear between whole days. */
export function oneWayAt(env: OpsEnvironment, t: number): number {
  const last = env.days.length - 1;
  const i = Math.max(0, Math.min(last, Math.floor(t)));
  const a = env.days[i]!;
  const b = env.days[Math.min(last, i + 1)]!;
  const f = Math.max(0, Math.min(1, t - i));
  return a.oneWay_s + (b.oneWay_s - a.oneWay_s) * f;
}

/** When a command sent at t (days) reaches the craft (days). */
export function commandArrival(env: OpsEnvironment, sentAt: number): number {
  return sentAt + oneWayAt(env, sentAt) / 86_400;
}

/** When news of something that happens on the craft at t reaches Earth (days). */
export function newsArrival(env: OpsEnvironment, t: number): number {
  return t + oneWayAt(env, t) / 86_400;
}

/** True during a solar-conjunction moratorium (no commands, no downlink). */
export function inMoratorium(env: OpsEnvironment, t: number): boolean {
  return env.days[Math.max(0, Math.floor(t))]?.conjunction ?? false;
}

/** First whole day after the moratorium that contains t. */
export function moratoriumEndDay(env: OpsEnvironment, t: number): number {
  let d = Math.max(0, Math.floor(t));
  while (env.days[d]?.conjunction) d++;
  return d;
}
