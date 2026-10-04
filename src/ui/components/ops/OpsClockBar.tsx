// The console's clock row (mockup: "Day 214 · Cruise", status chip, signal delay, speed buttons).
import type { OpsConsoleView } from '../../../engine/ops/console';
import * as f from '../../format';
import { CHIP, OPS_PHASE } from '../../opsWords';
import { OPS_SPEEDS, type OpsSpeed } from '../../useOpsSession';
import { PauseIcon, RadioIcon, SkipIcon } from './opsIcons';

interface Props {
  view: OpsConsoleView;
  engineer: boolean;
  destName: string;
  speed: OpsSpeed;
  locked: boolean;
  /** The mission has ended (complete, lost or never launched). */
  over: boolean;
  transit: boolean;
  onSpeed: (s: OpsSpeed) => void;
  onNext: () => void;
}

const SPEED_LABEL: Record<OpsSpeed, string> = { 0: 'Pause', 1: '1×', 10: '10×', 100: '100×' };

function subline(view: OpsConsoleView, destName: string): string {
  const c = view.clock;
  if (view.blackout.active && view.blackout.dayOf !== undefined && view.blackout.total !== undefined) return `Blackout · day ${f.num(view.blackout.dayOf)} of ${f.num(view.blackout.total)}`;
  if (c.chip === 'hazard') return 'Decision needed';
  if (c.chip === 'safe-mode') return 'Craft is in safe mode';
  if (c.chip === 'conjunction-soon' && view.blackout.upcoming) return `Solar conjunction in ${f.days(view.blackout.upcoming.inDays)}`;
  if (c.status === 'awaiting-extension') return 'Prime mission complete';
  if (c.status === 'lost') return 'Contact lost';
  if (c.status === 'complete') return 'Mission complete';
  if (!c.next) return '';
  if (c.next.kind === 'arrival') return `${f.days(c.next.inDays)} until you reach ${destName}`;
  if (c.next.kind === 'prime-end') return `${f.days(c.next.inDays)} of science to go`;
  return `${f.days(c.next.inDays)} of the extension to go`;
}

function signalLine(view: OpsConsoleView): string {
  if (view.map.signal === 'blocked') return 'No signal. The Sun is between Earth and your craft.';
  return `A message takes ${f.lightTime(view.clock.oneWay_s)} to reach your craft.`;
}

export function OpsClockBar({ view, engineer, destName, speed, locked, over, transit, onSpeed, onNext }: Props) {
  const c = view.clock;
  const chip = CHIP[c.chip];
  const blocked = view.map.signal === 'blocked';
  return (
    <div className="ops-clock">
      <div className="ops-day">
        <div className="ops-day-main">
          <span className="ops-day-num">
            Day <span className="mono-num">{f.num(c.day)}</span>
          </span>
          <span className="ops-day-phase">· {c.status === 'awaiting-extension' ? 'End of prime mission' : OPS_PHASE[c.phase]}</span>
          <span className={`chip ${chip.tone} ops-chip`}>
            <span className="ops-chip-dot" aria-hidden="true" />
            {chip.label}
          </span>
        </div>
        {engineer ? (
          <div className="ops-met mono">
            MET {f.met(c.t)} · {f.isoDate(c.date)}
          </div>
        ) : (
          <div className="ops-sub">{subline(view, destName)}</div>
        )}
      </div>

      <div className="ops-signal" aria-live="polite">
        <span className={blocked ? 'bad' : 'bp'}>
          <RadioIcon off={blocked} />
        </span>
        <div className="ops-signal-num">
          <span className="ops-label">SIGNAL DELAY · ONE WAY</span>
          <span className="mono">{blocked ? '—' : f.lightTime(c.oneWay_s)}</span>
        </div>
        {engineer ? (
          <div className="ops-signal-eng mono">
            <span>Δ⊕ {f.au(c.earthDistance_m)} · {f.millionKm(c.earthDistance_m)}</span>
            <span>
              {c.sepAngle_deg !== undefined ? `SEP ${f.deg(c.sepAngle_deg)}` : 'SEP —'} · r☉ {f.au(c.sunDistance_m)}
            </span>
          </div>
        ) : (
          <span className="ops-signal-cadet">{signalLine(view)}</span>
        )}
      </div>

      <div className="ops-speed-wrap">
        {(locked || transit) && (
          <span className="ops-paused">
            <span className="ops-label warn">{transit ? 'COMMAND IN FLIGHT' : over ? 'OPERATIONS ENDED' : 'AUTO-PAUSED'}</span>
            <span>{transit ? 'Time runs fast until it arrives' : over ? 'The mission clock has stopped' : 'Time stops while you decide'}</span>
          </span>
        )}
        <div className={`ops-speed${locked || transit ? ' locked' : ''}`} role="group" aria-label="Mission speed">
          {OPS_SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={speed === s}
              aria-label={s === 0 ? 'Pause' : `${SPEED_LABEL[s]} speed`}
              title={s === 0 ? 'Pause (space)' : `${SPEED_LABEL[s]}: days per minute`}
              disabled={locked || transit}
              onClick={() => onSpeed(s)}
            >
              {s === 0 ? <PauseIcon /> : SPEED_LABEL[s]}
            </button>
          ))}
        </div>
        <button type="button" className="ops-next" onClick={onNext} disabled={locked || transit} title="Jump to the next event (N)">
          <SkipIcon />
          <span>Next event</span>
        </button>
      </div>
    </div>
  );
}
