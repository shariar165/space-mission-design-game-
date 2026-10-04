// Spec section: "Launch vehicles". Payload is a curve in C3, read by piecewise-linear interpolation.
import { makeMeter } from './meter';
import type { Meter, Sourced } from './types';

/**
 * m_max(C3) = m_i + (m_{i+1} − m_i)(C3 − C3_i)/(C3_{i+1} − C3_i).
 * Below the first point the first point's mass is held (conservative); above the last point there is no capacity.
 */
export function payloadAtC3(curve: [number, number][], c3: number): { mass_kg: number; inRange: boolean } {
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (!first || !last) throw new Error('Launch vehicle curve has no points');
  if (c3 < first[0]) return { mass_kg: first[1], inRange: false };
  if (c3 > last[0]) return { mass_kg: 0, inRange: false };
  for (let i = 0; i < curve.length - 1; i++) {
    const [c0, m0] = curve[i]!;
    const [c1, m1] = curve[i + 1]!;
    if (c3 >= c0 && c3 <= c1) return { mass_kg: m0 + ((m1 - m0) * (c3 - c0)) / (c1 - c0), inRange: true };
  }
  return { mass_kg: last[1], inRange: true };
}

const fmt = (x: number) => String(Math.round(x * 10) / 10);

/** Mass margin = (m_max − m_wet) / m_max; over capacity blocks launch with a plain-language message. */
export function launchMassCheck(
  curve: [number, number][],
  c3: number,
  mWet_kg: number,
  inputs: Record<string, Sourced<number>> = {},
): { meter: Meter; blocker?: string } {
  const { mass_kg: mMax } = payloadAtC3(curve, c3);
  const margin = mMax > 0 ? (mMax - mWet_kg) / mMax : -Infinity;
  const meter = makeMeter(mWet_kg, mMax, margin, 'm_max(C3) by linear interpolation; margin = (m_max − m_wet)/m_max', inputs);
  if (mWet_kg <= mMax) return { meter };
  const blocker =
    mMax > 0
      ? `Too heavy by ${Math.round(mWet_kg - mMax)} kg for this rocket at C3 = ${fmt(c3)}`
      : `This rocket cannot reach C3 = ${fmt(c3)} km²/s² with any payload`;
  return { meter, blocker };
}

/** Laplace estimate p = (successes + 1)/(flights + 2), so a rocket with few flights is not shown as 100% safe. */
export function launchSuccessProbability(successes: number, flights: number): number {
  return (successes + 1) / (flights + 2);
}

/**
 * Rideshare (spec: Launch vehicles › Rideshare): the craft flies as the secondary payload of a real shared
 * launch. Its limit is the secondary slot, and never more than what the rocket can carry after the primary:
 * m_max = min(m_slot, m_LV(C3) − m_primary).
 */
export function rideshareCapacity(curve: [number, number][], c3: number, slot_kg: number, primary_kg: number): number {
  return Math.min(slot_kg, Math.max(0, payloadAtC3(curve, c3).mass_kg - primary_kg));
}

export function rideshareMassCheck(
  curve: [number, number][],
  c3: number,
  mWet_kg: number,
  slot_kg: number,
  primary_kg: number,
  inputs: Record<string, Sourced<number>> = {},
): { meter: Meter; blocker?: string } {
  const mMax = rideshareCapacity(curve, c3, slot_kg, primary_kg);
  const margin = mMax > 0 ? (mMax - mWet_kg) / mMax : -Infinity;
  const meter = makeMeter(mWet_kg, mMax, margin, 'm_max = min(secondary slot, m_LV(C3) − m_primary); margin = (m_max − m_wet)/m_max', inputs);
  if (mWet_kg <= mMax) return { meter };
  return { meter, blocker: `Too heavy by ${Math.round(mWet_kg - mMax)} kg for the shared ride's ${Math.round(mMax)} kg secondary slot` };
}

/** Game rule: the secondary pays a mass-proportional share of the rocket price, price × m_wet / (m_wet + m_primary). */
export function rideshareLaunchPrice(price_M: number, mWet_kg: number, primary_kg: number): number {
  return (price_M * mWet_kg) / (mWet_kg + primary_kg);
}
