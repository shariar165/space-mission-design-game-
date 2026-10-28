// Console panels from the mockup: command queue (1j), radio blackout (1l), safe mode (1m), mission extension (1p),
// plus the end-of-operations summary and the receipt toast. Values from consoleView() and operationsDebrief().
import { PARTS } from '../../../engine/data';
import type { ConsoleBlackout, ConsoleCommand, ConsoleScience, OpsConsoleView } from '../../../engine/ops/console';
import type { OpsDebrief } from '../../../engine/ops/index';
import type { ExtensionOption } from '../../../engine/ops/types';
/** Stars a flight can earn (as the Debrief). */
const STAR_COUNT = 3;
import * as f from '../../format';
import { cssPct } from '../../opsGeometry';
import { DRAWER_WORDS, EXTENSION_BLOCKER, OPS_PHASE } from '../../opsWords';
import type { Notice } from '../../useOpsSession';
import { Star } from '../icons';
import { BlockIcon, ExtendIcon, RadioIcon, RetireIcon, SkipIcon, SunIcon } from './opsIcons';

const instrumentName = (id: string) => PARTS.instruments[id]?.name ?? id;
const W = DRAWER_WORDS;

// ---------------------------------------------------------------------------

export function CommandQueue({
  commands,
  blackout,
  engineer,
  optionLabel,
  onClose,
  onPlan,
  onCall,
}: {
  commands: ConsoleCommand[];
  blackout: ConsoleBlackout;
  engineer: boolean;
  optionLabel: (c: ConsoleCommand) => string;
  onClose: () => void;
  onPlan: () => void;
  onCall: () => void;
}) {
  const inFlight = commands.filter((c) => c.status === 'in-flight');
  const done = commands.filter((c) => c.status !== 'in-flight').slice(-4).reverse();
  const up = blackout.upcoming?.soon ? blackout.upcoming : undefined;
  return (
    <section className="ops-panel ops-queue" aria-label={W.queue.title}>
      <div className="ops-panel-head">
        <span className="h2">{W.queue.title}</span>
        <span className="ops-label">{W.queue.counts(f.num(inFlight.length), f.num(done.length))}</span>
        <button type="button" className="ops-close" aria-label={W.queue.close} onClick={onClose}>
          ×
        </button>
      </div>
      {(blackout.active || up) && (
        <div className="ops-warnbox">
          <SunIcon size={18} />
          <div>
            {blackout.active ? (
              <div className="b">{W.queue.sunNow(f.num(blackout.retryAfterDay ?? 0))}</div>
            ) : (
              up && (
                <>
                  <div className="b">{W.queue.sunSoon(up.inDays, f.num(up.window.startDay))}</div>
                  <div className="muted">{W.queue.sunThen(up.length_days)}</div>
                </>
              )
            )}
            {engineer && up && (
              <div className="ops-eng-line mono warn">
                SEP &lt; threshold · day {f.num(up.window.startDay)} → {f.num(up.window.endDay)} · last uplink day {f.num(up.lastSendDay)}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="ops-queue-list">
        {inFlight.length === 0 && done.length === 0 && <p className="muted">{W.queue.empty}</p>}
        {inFlight.map((c) => (
          <div key={c.id} className="ops-cmd flying">
            <div className="ops-cmd-top">
              <span className="ops-label acc">{W.queue.onItsWay}</span>
              <span className="ops-label">{W.queue.sentDay(f.num(Math.floor(c.sentAt)))}</span>
            </div>
            <div className="h3">{optionLabel(c)}</div>
            <div className="ops-cmd-eta">
              <span className="muted">{W.queue.arrivesIn}</span>
              <span className="mono acc">{f.clock(c.timeLeft_s)}</span>
            </div>
            <div className="ops-track small">
              <span className="ops-track-fill" style={{ width: cssPct(c.progress) }} />
            </div>
            {engineer && (
              <div className="ops-eng-line mono">
                CMD #{f.num(c.id)} · {c.kind} · day {f.num(c.sentAt, 4)} → {f.num(c.arrivesAt, 4)}
              </div>
            )}
          </div>
        ))}
        {done.map((c) => (
          <div key={c.id} className={`ops-cmd ${c.status}`}>
            <div className="ops-cmd-top">
              <span className={`ops-label ${c.status === 'executed' ? 'ok' : 'warn'}`}>{c.status === 'executed' ? W.queue.carriedOut : W.queue.tooLate}</span>
              <span className="ops-label">{W.queue.day(f.num(Math.floor(c.arrivesAt)))}</span>
            </div>
            <div className="h3">{optionLabel(c)}</div>
          </div>
        ))}
      </div>
      <div className="ops-panel-foot">
        <button type="button" className="btn ghost" onClick={onPlan}>
          {W.queue.plan}
        </button>
        <button type="button" className="cta" onClick={onCall}>
          {W.queue.call}
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function BlackoutPanel({ view, engineer, onSkip }: { view: OpsConsoleView; engineer: boolean; onSkip: (day: number) => void }) {
  const b = view.blackout;
  if (!b.active || b.total === undefined || b.dayOf === undefined) return null;
  const now = b.dayOf;
  return (
    <section className="ops-panel ops-blackout" aria-label={W.blackout.label} aria-live="polite">
      <div className="ops-panel-title bad">
        <span className="ops-icon-box bad">
          <RadioIcon size={24} off />
        </span>
        <span className="ops-label bad">{W.blackout.kicker(f.num(b.dayOf), f.num(b.total))}</span>
      </div>
      <h2 className="ops-alert-title">{W.blackout.title(b.total)}</h2>
      <p className="muted">
        {W.blackout.before}
        <b>{W.blackout.day(f.num(b.retryAfterDay ?? 0))}</b>
        {W.blackout.after(b.daysLeft ?? 0)}
      </p>
      <div className="ops-bo-days" aria-hidden="true">
        {Array.from({ length: b.total }, (_, i) => (
          <span key={i} className={i + 1 < now ? 'past' : i + 1 === now ? 'now' : ''} />
        ))}
      </div>
      {engineer && (
        <div className="ops-eng-box mono">
          <div>SEP {view.clock.sepAngle_deg !== undefined ? f.deg(view.clock.sepAngle_deg, 2) : '—'} · min {f.deg(b.window?.minAngle_deg ?? 0, 2)} on day {f.num(b.window?.minDay ?? 0)}</div>
          <div>no uplink, no downlink · recorder {f.pct(view.gauges.recorder.fill, 0)} full</div>
        </div>
      )}
      <button type="button" className="btn wide" onClick={() => onSkip(b.retryAfterDay ?? view.clock.day)}>
        <SkipIcon />
        {W.blackout.skip(f.num(b.retryAfterDay ?? 0))}
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function SafeModePanel({ science, engineer }: { science: ConsoleScience; engineer: boolean }) {
  if (!science.paused || science.cause !== 'safe-mode') return null;
  return (
    <section className="ops-panel ops-safe" aria-label={W.safe.label} aria-live="polite">
      <span className="chip warning">{W.safe.chip}</span>
      <h2 className="ops-alert-title">{W.safe.title}</h2>
      <p className="muted">{W.safe.body}</p>
      <div className="ops-chips">
        {science.instrumentsOff.map((id) => (
          <span key={id} className="ops-cost off">
            <span className="ops-dot off" />
            {W.safe.off(instrumentName(id))}
          </span>
        ))}
        <span className="ops-cost on">
          <span className="ops-dot on" />
          {W.safe.beacon}
        </span>
      </div>
      <div className="ops-resume">
        {W.safe.resumes}
        <b>{W.safe.day(f.num(Math.ceil(science.resumesAt ?? 0)))}</b>
      </div>
      {engineer && <div className="ops-eng-box mono">fault protection: sun-point, instruments off · resume at day {f.num(science.resumesAt ?? 0, 2)}</div>}
    </section>
  );
}

// ---------------------------------------------------------------------------

export function ExtensionDecision({
  options,
  engineer,
  destName,
  scienceDays,
  onChoose,
}: {
  options: ExtensionOption[];
  engineer: boolean;
  destName: string;
  scienceDays: number;
  onChoose: (id: string) => void;
}) {
  return (
    <section className="ops-ext" aria-label={W.ext.label}>
      <div className="ops-ext-head">
        <span className="ops-label acc">{W.ext.kicker}</span>
        <h2 className="ops-ext-title">{W.ext.title}</h2>
        <p className="muted">{W.ext.sub(scienceDays, destName)}</p>
      </div>
      <div className="ops-ext-grid">
        {options.map((o) => {
          const end = o.years === 0;
          const blocked = o.blockedBy.length > 0;
          return (
            <div key={o.id} className={`ops-ext-card${end ? '' : ' extend'}${blocked ? ' blocked' : ''}`}>
              <div className="ops-ext-card-head">
                <span className={`ops-icon-box ${end ? 'bp' : 'acc'}`}>{end ? <RetireIcon /> : <ExtendIcon />}</span>
                <span className="ops-ext-name">{end ? W.ext.retire : W.ext.extendBy(o.years)}</span>
                {end && !engineer && <span className="ops-ext-rec">{W.ext.recommended}</span>}
              </div>
              <p className="muted">
                {end ? W.ext.retireBody : `${W.ext.extendBody}${engineer ? '' : W.ext.extendCadet}`}
              </p>
              {!end && (
                <div className="ops-ext-rows">
                  <div className="ops-row">
                    <span className="muted">{W.ext.moreScience}</span>
                    <span className="mono">{f.gbit(o.expectedData_Gbit)}</span>
                  </div>
                  <div className="ops-row">
                    <span className="muted">{W.ext.fuel}</span>
                    <span className={`mono ${o.blockedBy.includes('deltaV') ? 'bad' : ''}`}>
                      {W.ext.of(f.speed(o.deltaVNeeded_ms), f.speed(o.deltaVLeft_ms))}
                    </span>
                  </div>
                  <div className="ops-row">
                    <span className="muted">{W.ext.powerEnd}</span>
                    <span className={`mono ${o.blockedBy.includes('power') ? 'bad' : ''}`}>{f.signedPct(o.powerMarginAtEnd, 0)}</span>
                  </div>
                  <div className="ops-row">
                    <span className="muted">{W.ext.newMoney}</span>
                    <span className="mono">{f.money(o.cost_M, 1)}</span>
                  </div>
                </div>
              )}
              {blocked && (
                <div className="ops-why">
                  <BlockIcon />
                  {o.blockedBy.map((b) => EXTENSION_BLOCKER[b]).join(' · ')}
                </div>
              )}
              {engineer && !end && (
                <div className="ops-eng-box mono">
                  <div>Δv need = maintenance/day × {f.num(o.days)} d</div>
                  <div>science review: {o.approved ? 'approved' : 'not approved'}</div>
                </div>
              )}
              <button type="button" className={end ? 'btn wide' : 'cta wide'} disabled={blocked} onClick={() => onChoose(o.id)}>
                {end ? W.ext.retireKey : W.ext.extendKey}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function OpsSummary({ debrief, destName, onExit, onRestart }: { debrief: OpsDebrief; destName: string; onExit: () => void; onRestart: () => void }) {
  const lost = debrief.status === 'lost' && !debrief.completed;
  const ext = debrief.extension;
  return (
    <section className="ops-summary" aria-label="Operations debrief">
      <span className="ops-label acc">OPERATIONS DEBRIEF</span>
      <h2 className="ops-ext-title">
        {lost ? `Contact lost in the ${OPS_PHASE[debrief.failedPhase ?? 'cruise'].toLowerCase()} phase.` : `Prime mission at ${destName} complete.`}
      </h2>
      <div className="ops-sum-stars" aria-label={`${debrief.stars} of ${STAR_COUNT} stars`}>
        {Array.from({ length: STAR_COUNT }, (_, i) => (
          <Star key={i} filled={i < debrief.stars} size={30} />
        ))}
        <span className="mono muted">{f.num(debrief.score)} PTS · PRIME MISSION</span>
      </div>
      <div className="ops-sum-grid">
        <div className="ops-row">
          <span className="muted">Science sent home</span>
          <span className="mono">
            {f.gbit(debrief.downlinked_Gbit)} of {f.gbit(debrief.goal_Gbit)}
          </span>
        </div>
        <div className="ops-row">
          <span className="muted">Science days</span>
          <span className="mono">
            {f.num(debrief.scienceDaysAchieved)} of {f.num(debrief.plannedScienceDays)}
          </span>
        </div>
        <div className="ops-row">
          <span className="muted">Hazards faced</span>
          <span className="mono">{f.num(debrief.hazards.length)}</span>
        </div>
        <div className="ops-row">
          <span className="muted">Δv left</span>
          <span className="mono">{f.speed(debrief.deltaV.left_ms)}</span>
        </div>
      </div>
      <div className="ops-sum-ext">
        <span className="ops-label bp">EXTENDED MISSION · REPORTED SEPARATELY</span>
        <span>
          {ext.outcome === 'not-offered'
            ? 'No extension was possible.'
            : ext.outcome === 'declined'
              ? 'You retired the craft at the end of the prime mission.'
              : ext.outcome === 'lost'
                ? `Lost after ${f.days(ext.daysFlown)} of extra flying, with ${f.gbit(ext.downlinked_Gbit)} more science sent home.`
                : `${f.days(ext.daysFlown)} of extra flying, ${f.gbit(ext.downlinked_Gbit)} more science, ${f.money(ext.cost_M, 1)} of new money.`}
        </span>
        <span className="faint">Your stars and score come from the prime mission only, so an extension can never take them away.</span>
      </div>
      <p className="muted">{debrief.hint}</p>
      <div className="actions">
        <button type="button" className="cta" onClick={onExit}>
          Back to the debrief
        </button>
        <button type="button" className="btn ghost" onClick={onRestart}>
          Fly operations again
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function NoticeToast({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const text =
    notice.kind === 'sent'
      ? W.notice.sent
      : notice.kind === 'booked'
        ? W.notice.booked(f.num(notice.day), notice.dish === 70)
        : notice.reason === 'conjunction'
          ? W.notice.conjunction(f.num(notice.retryAfterDay ?? 0))
          : notice.reason === 'lead-time'
            ? W.notice.leadTime(f.num(notice.retryAfterDay ?? 0))
            : notice.reason === 'not-flying'
              ? W.notice.notFlying
              : W.notice.refused;
  return (
    <div className={`ops-toast ${notice.kind === 'refused' ? 'bad' : 'ok'}`} role="status">
      <span>{text}</span>
      <button type="button" className="ops-close" aria-label={W.notice.dismiss} onClick={onClose}>
        ×
      </button>
    </div>
  );
}

