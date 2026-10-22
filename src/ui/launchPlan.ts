// The launch plan shared by Pack and the Launch Day step: the calendar's transfers (worked out once per level and
// kept, so moving between the two screens is instant), each day's quality for the packed craft, and the day it
// flies: the player's pick, or the engine's best day (pack.ts bestLaunchDay). Every number is the engine's.
import { useEffect, useMemo, useState } from 'react';
import { evaluateDesign } from '../engine/index';
import { bestLaunchDay, buildPackDesign, calendarTransfers, dayQuality, onDay, PACK, type CalendarDay, type DayQuality, type Packed } from '../engine/pack';
import type { Design, DestinationId } from '../engine/types';

const calendars = new Map<string, CalendarDay[]>();

/** The calendar for a destination around its best date; undefined for one tick while it is worked out. */
export function useLaunchCalendar(destination: DestinationId, bestDate: string): CalendarDay[] | undefined {
  const key = `${destination}|${bestDate}`;
  const [days, setDays] = useState<CalendarDay[] | undefined>(() => calendars.get(key));
  useEffect(() => {
    const known = calendars.get(key);
    if (known) {
      setDays(known);
      return;
    }
    setDays(undefined);
    // One tick after the screen paints: the transfers take a moment.
    const id = setTimeout(() => {
      const d = calendarTransfers(destination, bestDate);
      calendars.set(key, d);
      setDays(d);
    }, 0);
    return () => clearTimeout(id);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return days;
}

export interface LaunchPlan {
  days?: CalendarDay[];
  /** The day flown: the pick, or the best day. */
  dayIdx: number;
  /** No pick: the best day was chosen for the player. */
  auto: boolean;
  day?: CalendarDay;
  design: Design;
  ev: ReturnType<typeof evaluateDesign>;
  quality: DayQuality[];
  q?: DayQuality;
}

/** The packed craft on its launch day. `pick` is the player's day (an index into the calendar), if any. */
export function useLaunchPlan(base: Design, packed: Packed, pick?: number): LaunchPlan {
  const days = useLaunchCalendar(base.destination, base.launchDate);
  const packedDesign = useMemo(() => buildPackDesign(base, packed), [base, packed]);
  const preferred = PACK.calendar.before.value;
  // The best day is judged on the craft at the starter's day (its mass and Δv capability do not change with the day).
  const best = useMemo(() => {
    if (!days) return preferred;
    const d0 = onDay(packedDesign, days[preferred] ?? days[0]!);
    const ev0 = evaluateDesign(d0);
    return bestLaunchDay(days.map((t) => dayQuality(d0, ev0, t)), preferred);
  }, [days, packedDesign, preferred]);
  const auto = pick === undefined || !days || pick < 0 || pick >= days.length;
  const dayIdx = auto ? best : pick;
  const day = days?.[dayIdx];
  const design = useMemo(() => (day ? onDay(packedDesign, day) : packedDesign), [packedDesign, day]);
  const ev = useMemo(() => evaluateDesign(design), [design]);
  const quality = useMemo(() => (days ? days.map((t) => dayQuality(design, ev, t)) : []), [days, design, ev]);
  return { ...(days ? { days } : {}), dayIdx, auto, ...(day ? { day } : {}), design, ev, quality, ...(quality[dayIdx] ? { q: quality[dayIdx] } : {}) };
}
