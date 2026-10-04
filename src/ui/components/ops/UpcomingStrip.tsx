// The Upcoming strip (mockup footer): the next days as bands (conjunction, eclipse season) and staggered point
// events (passes, burns, phases), with the NOW cursor at the left. Positions are engine fractions.
import type { ConsoleTimeline, TimelineEvent } from '../../../engine/ops/console';
import * as f from '../../format';
import { cssPct, packLanes, textPx, useWidth } from '../../opsGeometry';
import { OPS_PHASE } from '../../opsWords';
import { BurnIcon, DishIcon, EclipseIcon, SunIcon } from './opsIcons';

interface Props {
  timeline: ConsoleTimeline;
  engineer: boolean;
  destName: string;
  /** Book a pass on this day (open slot). */
  onBook: (day: number) => void;
  blackoutDaysLeft?: number;
}

function label(e: TimelineEvent, engineer: boolean, destName: string): { l: string; s: string } {
  switch (e.kind) {
    case 'burn':
      return e.burnKind === 'arrival'
        ? { l: 'Orbit insertion', s: engineer ? `Δv ${f.speed(e.dv_ms ?? 0)}` : `the big burn at ${destName}` }
        : { l: 'Course fix', s: engineer ? `TCM · Δv ${f.speed(e.dv_ms ?? 0)}` : 'small nudge' };
    case 'dsn':
      return {
        l: e.lastBeforeBlackout ? 'Last call' : e.firstAfterBlackout ? 'First call back' : e.dish === 70 ? 'Big dish' : 'Small dish',
        s: engineer ? `${f.num(e.dish ?? 0)} m · ${f.num(e.hours ?? 0)} h pass` : e.lastBeforeBlackout ? 'before the blackout' : e.firstAfterBlackout ? 'radio is back' : 'call home booked',
      };
    case 'open-slot':
      return { l: 'Open slot', s: engineer ? 'book a small or big dish' : 'tap to book a call' };
    case 'phase':
      return { l: OPS_PHASE[e.phase ?? 'cruise'], s: engineer ? 'phase start' : 'begins' };
    case 'dose':
      return { l: 'Radiation', s: engineer ? f.pct(e.fraction ?? 0, 0) : 'dose milestone' };
  }
}

export function UpcomingStrip({ timeline, engineer, destName, onBook, blackoutDaysLeft }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const items = packLanes(
    timeline.events.map((e) => ({ ...e, ...label(e, engineer, destName) })),
    width,
    (e) => textPx(e.l.length > e.s.length ? e.l : e.s, engineer ? 6.6 : 6.4),
    2,
  );
  return (
    <footer className="ops-upcoming" aria-label="Upcoming events">
      <div className="ops-up-head">
        <span className="h3">Upcoming</span>
        <span className="ops-label">
          NEXT {f.num(timeline.days)} DAYS · DAY {f.num(timeline.from)} → {f.num(timeline.to)}
        </span>
        <span className="ops-legend">
          <span>
            <span className="lg-dish">
              <DishIcon size={11} />
            </span>
            Call home booked
          </span>
          <span>
            <span className="lg-open" />
            Open slot
          </span>
          <span>
            <span className="lg-burn">
              <BurnIcon size={11} />
            </span>
            Engine burn
          </span>
          <span>
            <span className="lg-conj" />
            Radio blackout
          </span>
          <span>
            <span className="lg-ecl" />
            Eclipse season
          </span>
        </span>
      </div>
      <div className="ops-up-row">
        <div className="ops-strip" ref={ref}>
          <div className="ops-strip-axis" />
          {timeline.bands.map((b) => (
            <div key={`${b.kind}-${b.startDay}`} className={`ops-band ${b.kind}${b.active ? ' active' : ''}`} style={{ left: cssPct(b.left), width: cssPct(b.width) }}>
              <span className="ops-band-l">
                {b.kind === 'conjunction' ? <SunIcon size={12} /> : <EclipseIcon size={12} />}
                {b.kind === 'conjunction'
                  ? b.active && blackoutDaysLeft !== undefined
                    ? `Blackout · ${f.days(blackoutDaysLeft)} left`
                    : 'Solar conjunction · no radio'
                  : 'Eclipse season'}
              </span>
              {engineer && (
                <span className="ops-band-e mono">
                  {b.kind === 'conjunction'
                    ? `SEP min ${f.deg(b.minAngle_deg ?? 0, 2)} · day ${f.num(b.startDay)}–${f.num(b.endDay)}`
                    : `shadow ≤ ${f.lightTime(b.longestEclipse_s ?? 0)} / orbit`}
                </span>
              )}
            </div>
          ))}
          {timeline.ticks.map((t) => (
            <div key={t.day} className="ops-tick" style={{ left: cssPct(t.left) }}>
              <span />
              <span className="mono">Day {f.num(t.day)}</span>
            </div>
          ))}
          {items.map((e) => {
            const cls = `ops-ev ${e.kind}${e.dish === 70 ? ' big' : ''}${e.lastBeforeBlackout ? ' last' : ''} lane-${e.lane}`;
            const body = (
              <>
                <span className="ops-ev-stem-wrap">
                  <span className="ops-ev-dot">
                    {e.kind === 'burn' ? <BurnIcon size={12} /> : e.kind === 'open-slot' ? '+' : e.kind === 'phase' ? '◆' : <DishIcon size={12} />}
                  </span>
                  <span className="ops-ev-stem" />
                </span>
                {e.showLabel && (
                  <span className="ops-ev-text">
                    <span className="ops-ev-l">{e.l}</span>
                    {(engineer || e.s) && <span className="ops-ev-s">{e.s}</span>}
                  </span>
                )}
              </>
            );
            return e.kind === 'open-slot' ? (
              <button key={`${e.kind}-${e.day}`} type="button" className={cls} style={{ left: cssPct(e.left) }} title={`${e.l}: day ${f.num(e.day)}`} onClick={() => onBook(e.day)}>
                {body}
              </button>
            ) : (
              <div key={`${e.kind}-${e.day}`} className={cls} style={{ left: cssPct(e.left) }} title={`${e.l}: day ${f.num(e.day)}`}>
                {body}
              </div>
            );
          })}
          <div className="ops-now" />
          <span className="ops-now-l">NOW</span>
        </div>
        {timeline.ahead && (
          <div className="ops-ahead">
            <span className="ops-label acc">
              <BurnIcon size={12} />
              {timeline.ahead.kind === 'arrival' ? 'ORBIT INSERTION' : 'END OF PRIME MISSION'}
            </span>
            <span className="h3">Day {f.num(timeline.ahead.day)}</span>
            <span className="muted">in {f.days(timeline.ahead.inDays)}</span>
          </div>
        )}
      </div>
    </footer>
  );
}
