// MARS RIGHT NOW (Home; spec UI rule 36): today's distance, one-way light time and next solar conjunction. Every
// number is engine output (marsNow); this only formats it.
import type { MarsNow } from '../../../engine/marsNow';
import * as f from '../../format';
import { MARS_NOW } from '../../sdWords';

export function MarsNowPlate({ mars, className = '' }: { mars: MarsNow; className?: string }) {
  const c = mars.conjunction;
  return (
    <section className={`hm-now sd-crt-text ${className}`.trim()} aria-label="Mars right now">
      <span className="hm-now-k">{MARS_NOW.title}</span>
      <span className="hm-now-row">
        <b>{f.millionKm(mars.distance_m)}</b> {MARS_NOW.away}
      </span>
      <span className="hm-now-row">
        {MARS_NOW.takes} <b>{f.lightTime(mars.lightTime_s)}</b> {MARS_NOW.oneWay}
      </span>
      {c.now ? (
        <span className="hm-now-row hm-now-alert">
          {MARS_NOW.now} {MARS_NOW.until} <b>{f.isoDate(c.endDate)}</b>
        </span>
      ) : (
        <span className="hm-now-row">
          {MARS_NOW.next} <b>{f.isoDate(c.closestDate)}</b> {MARS_NOW.in} <b>{f.days(c.inDays)}</b>
        </span>
      )}
    </section>
  );
}
