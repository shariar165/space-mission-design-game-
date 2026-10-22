// The launch calendar (Signal Delay Pack design, LAUNCH DAY): six weeks of launch days, each coloured by how well the
// packed craft can make it that day (engine dayQuality). Used by the Launch Day step.
import type { CalendarDay, DayQuality } from '../../../engine/pack';
import * as f from '../../format';
import { DAY_WORDS, monthSpan, shortDate } from '../../sdWords';

interface Props {
  days?: CalendarDay[];
  quality: DayQuality[];
  dayIdx: number;
  onPick: (i: number) => void;
  destName: string;
  engineer: boolean;
  phone: boolean;
}

export function LaunchCalendar({ days, quality, dayIdx, onPick, destName, engineer, phone }: Props) {
  const day = days?.[dayIdx];
  const q = quality[dayIdx];
  return (
    <div className="pk-cal">
      <div className="pk-cal-head">
        <span className="sd-label">{days ? `LAUNCH DAY · ${monthSpan(days[0]!.date, days[days.length - 1]!.date)}` : 'LAUNCH DAY'}</span>
        <span className={`pk-cal-msg ${q?.quality ?? ''}`}>
          {!days || !day || !q
            ? 'WORKING OUT THE LAUNCH DAYS…'
            : `${shortDate(day.date)} · ${engineer && day.c3 !== undefined ? `C3 = ${f.c3(day.c3)}` : phone ? DAY_WORDS[q.quality].short : DAY_WORDS[q.quality].msg(destName)}`}
        </span>
      </div>
      <div className="pk-cal-days" role="radiogroup" aria-label="Launch day">
        {(days ?? []).map((t, i) => (
          <button
            key={t.date}
            type="button"
            role="radio"
            aria-checked={i === dayIdx}
            aria-label={`${shortDate(t.date)}: ${DAY_WORDS[quality[i]?.quality ?? 'bad'].short}`}
            className={`pk-day ${quality[i]?.quality ?? 'bad'}${i === dayIdx ? ' on' : ''}`}
            title={shortDate(t.date)}
            onClick={() => onPick(i)}
          />
        ))}
      </div>
      {!phone && days && (
        <div className="pk-cal-ticks">
          {days
            .filter((_, i) => i % 7 === 0)
            .map((t) => (
              <span key={t.date}>{shortDate(t.date)}</span>
            ))}
        </div>
      )}
    </div>
  );
}
