// Book a call home (mockup 1d): a small (34 m) or big (70 m) dish for one day's pass. Ground-side, so no light
// delay, but booked a lead time ahead. Rates, data, photos and the extra aperture fee come from dsnOptions().
import { useMemo, useState } from 'react';
import { dsnOptions, type OpsState } from '../../../engine/ops/index';
import * as f from '../../format';
import { CoinIcon, DishIcon } from './opsIcons';

interface Props {
  state: OpsState;
  day?: number;
  engineer: boolean;
  onBook: (day: number, dish: 34 | 70, hours: number) => void;
  onClose: () => void;
}

export function BookCall({ state, day: initial, engineer, onBook, onClose }: Props) {
  const [day, setDay] = useState<number | undefined>(initial);
  const o = useMemo(() => dsnOptions(state, day), [state, day]);
  const [dish, setDish] = useState<34 | 70>(70);
  const pick = o.options.find((x) => x.dish === dish)!;
  return (
    <section className="ops-panel ops-call" aria-label="Book a call home">
      <div className="ops-panel-head">
        <span className="h2">Book a call home</span>
        <span className="ops-label">
          DAY {f.num(o.day)} · {f.num(pick.hours)} H PASS
        </span>
        <button type="button" className="ops-close" aria-label="Close booking" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="ops-call-day">
        <button type="button" className="btn-sm" aria-label="Earlier day" onClick={() => setDay(o.day - 1)}>
          −
        </button>
        <span className="mono">Day {f.num(o.day)}</span>
        <button type="button" className="btn-sm" aria-label="Later day" onClick={() => setDay(o.day + 1)}>
          +
        </button>
        <span className="faint">first free day: {f.num(o.earliestDay)}</span>
      </div>
      <div className="ops-call-opts" role="radiogroup" aria-label="Dish">
        {o.options.map((x) => (
          <button key={x.dish} type="button" role="radio" aria-checked={dish === x.dish} className={`ops-call-opt${dish === x.dish ? ' chosen' : ''}`} onClick={() => setDish(x.dish)}>
            <span className="ops-call-name">
              <DishIcon size={16} />
              {x.dish === 70 ? 'Big dish' : 'Small dish'} · {f.num(x.dish)} m
            </span>
            <span className="ops-call-cost mono">
              <CoinIcon />
              {x.extraCost_M <= 0 ? (x.isStandard ? 'included' : 'free') : engineer ? f.money(x.extraCost_M, 3) : `${f.num(x.extraCoins)} coins`}
            </span>
            <span className="muted">{engineer ? `${f.rate(x.rate_bps)} · ${f.bits(x.data_bits)}` : `about ${f.photos(x.photos)} photos home`}</span>
            {x.booked && <span className="ops-label ok">BOOKED</span>}
          </button>
        ))}
      </div>
      {o.refused && (
        <p className="bad">
          {o.refused.reason === 'lead-time'
            ? `Too soon: book from day ${f.num(o.refused.retryAfterDay ?? 0)}.`
            : o.refused.reason === 'conjunction'
              ? `No radio that day (solar conjunction). Try day ${f.num(o.refused.retryAfterDay ?? 0)}.`
              : 'That day is after the mission ends.'}
        </p>
      )}
      <div className="ops-panel-foot">
        <button type="button" className="cta wide" disabled={o.refused !== undefined || pick.booked} onClick={() => onBook(o.day, pick.dish, pick.hours)}>
          {pick.booked ? 'Already booked' : `Book the ${dish === 70 ? 'big' : 'small'} dish`}
        </button>
      </div>
    </section>
  );
}
