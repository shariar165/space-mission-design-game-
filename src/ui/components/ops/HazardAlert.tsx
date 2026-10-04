// Hazard alert (mockup 1f/1g): the game auto-pauses; the player picks a response and sends it, watches it
// cross space (light-delay countdown), then sees what happened. All values come from consoleView().
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AlertOption, ConsoleAlert, ConsoleCommand, ConsoleOutcome } from '../../../engine/ops/console';
import * as f from '../../format';
import { cssPct } from '../../opsGeometry';
import { BLOCKER, FAILURE_EFFECT, OPTION_BLURB, RISK_WORD } from '../../opsWords';
import { SourceInfo } from '../SourceInfo';
import { AlertIcon, BatteryIcon, BlockIcon, CameraIcon, CoinIcon, FuelIcon, HistoryIcon, SendIcon } from './opsIcons';

const riskTone = (level: number) => (level >= 4 ? 'over' : level >= 3 ? 'warning' : 'ok');

function Chips({ o, engineer }: { o: AlertOption; engineer: boolean }) {
  const chips: { icon: ReactNode; t: string }[] = [];
  const sci = o.cost.scienceDays?.value ?? 0;
  const dv = o.cost.deltaV_ms?.value ?? 0;
  const money = o.cost.budget_M?.value ?? 0;
  if (sci > 0) chips.push({ icon: <CameraIcon />, t: engineer ? `−${f.days(sci)} science` : `${f.days(sci)} of photos` });
  if (dv > 0) chips.push({ icon: <FuelIcon />, t: engineer ? `Δv ${f.speed(dv)} · ${f.kg(o.fuel_kg)}` : `${f.kg(o.fuel_kg)} of fuel` });
  if (money > 0) chips.push({ icon: <CoinIcon />, t: engineer ? f.signedMoney(-money) : `${f.num(o.coins)} coins` });
  if (o.requires?.powerMargin) chips.push({ icon: <BatteryIcon />, t: engineer ? `needs power margin ≥ ${f.pct(o.requires.powerMargin.value, 0)}` : 'needs spare power' });
  if (chips.length === 0) chips.push({ icon: <CameraIcon />, t: engineer ? 'no cost' : 'costs nothing' });
  return (
    <span className="ops-chips">
      {chips.map((c) => (
        <span key={c.t} className="ops-cost">
          {c.icon}
          {c.t}
        </span>
      ))}
    </span>
  );
}

interface Props {
  alert?: ConsoleAlert;
  engineer: boolean;
  /** The response on its way, if one was sent, with the hazard's title and the option's label. */
  inFlight?: ConsoleCommand & { title: string; label: string };
  /** The response that reached the craft (and its outcome, once known). */
  result?: { hazardId: string; optionId: string; label: string; outcome?: ConsoleOutcome; title: string };
  onSend: (optionId: string) => void;
  onDefer: () => void;
  onResume: () => void;
}

export function HazardAlert({ alert, engineer, inFlight, result, onSend, onDefer, onResume }: Props) {
  const first = alert?.options.find((o) => o.affordable && o.isSafest) ?? alert?.options.find((o) => o.affordable);
  const [sel, setSel] = useState(first?.id);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => setSel(first?.id), [alert?.decisionId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Focus the dialog when it opens, so keyboard players land on it.
  useEffect(() => box.current?.focus(), [alert?.decisionId, inFlight?.id, result?.hazardId]);

  const stage = inFlight ? 'transit' : result ? 'result' : alert ? 'choose' : undefined;
  if (!stage) return null;
  const pick = alert?.options.find((o) => o.id === sel);

  return (
    <div
      className={`ops-alert ${stage}`}
      role="alertdialog"
      aria-modal="false"
      aria-labelledby="ops-alert-title"
      tabIndex={-1}
      ref={box}
      onKeyDown={(e) => {
        // Keep Tab inside the alert while it is open (focus trap).
        if (e.key !== 'Tab' || !box.current) return;
        const els = box.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]');
        if (!els.length) return;
        const a = els[0]!;
        const z = els[els.length - 1]!;
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }}
    >
      <div className="ops-alert-bar">
        <AlertIcon />
        <span>{stage === 'result' ? 'COMMAND RECEIVED' : `HAZARD · ${(alert?.title ?? inFlight?.title ?? result?.title ?? '').toUpperCase()}`}</span>
        {alert && <span className="ops-alert-time mono">DAY {f.num(Math.floor(alert.knownAt))}</span>}
      </div>

      {stage === 'choose' && alert && (
        <>
          <div className="ops-alert-body">
            <div>
              <h2 id="ops-alert-title" className="ops-alert-title">
                {alert.title}
              </h2>
              <p className="ops-alert-sit">{alert.prompt}</p>
              {engineer && (
                <div className="ops-eng-line mono">
                  {alert.detectedBy === 'earth' ? 'seen from Earth' : 'reported by the craft'} · onset day {f.num(alert.onset, 2)} · deadline day {f.num(alert.deadline, 2)} · earliest send day{' '}
                  {f.num(alert.earliestSend, 2)}
                </div>
              )}
            </div>
            <div className="ops-history">
              <HistoryIcon />
              <div>
                <div className="ops-history-head">
                  <span className="ops-label bp">REAL HISTORY</span>
                  {alert.realHistory.isGameEstimate && <span className="ops-verify">TO VERIFY</span>}
                  <SourceInfo s={alert.realHistory} title="Real history" />
                </div>
                <p>{alert.realHistory.value}</p>
              </div>
            </div>
            <div className="ops-label">CHOOSE A RESPONSE</div>
            <div className="ops-options" role="radiogroup" aria-label="Responses">
              {alert.options.map((o) => {
                const chosen = sel === o.id && o.affordable;
                const tone = riskTone(o.riskLevel);
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    aria-disabled={!o.affordable}
                    className={`ops-option${chosen ? ' chosen' : ''}${o.affordable ? '' : ' blocked'}`}
                    onClick={() => o.affordable && setSel(o.id)}
                  >
                    <span className="ops-option-main">
                      <span className="ops-option-title">
                        <span className="ops-radio" aria-hidden="true" />
                        <span className="ops-option-name">{o.label}</span>
                        {o.isFallback && <span className="ops-tag">{alert.fallback.by === 'standing-order' ? 'STANDING ORDER' : 'CRAFT DEFAULT'}</span>}
                      </span>
                      {!engineer && OPTION_BLURB[`${alert.type}.${o.id}`] && <span className="ops-option-line">{OPTION_BLURB[`${alert.type}.${o.id}`]}</span>}
                      <Chips o={o} engineer={engineer} />
                      {!o.affordable && (
                        <span className="ops-why">
                          <BlockIcon />
                          {o.blockedBy.map((b) => BLOCKER[b]).join(' · ')}
                        </span>
                      )}
                      {engineer && (
                        <span className="ops-eng-line mono">
                          P(fail) {f.pct(o.failureChance.value, 1)} → {o.failureEffect}
                        </span>
                      )}
                    </span>
                    <span className="ops-risk">
                      <span className="ops-label">RISK</span>
                      <span className="ops-risk-bar" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <span key={i} className={i <= o.riskLevel ? `on ${tone}` : ''} />
                        ))}
                      </span>
                      <span className={`ops-risk-l ${tone}`}>{RISK_WORD[o.riskLevel]}</span>
                      {!engineer && <span className="ops-risk-say">If it fails, {FAILURE_EFFECT[o.failureEffect]}.</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="ops-alert-foot">
            <div className="ops-alert-when">
              {alert.blockedByConjunction ? (
                <>No commands during the conjunction. The craft will follow its {alert.fallback.by === 'standing-order' ? 'standing order' : 'default'}.</>
              ) : (
                <>
                  Your command reaches the craft <b className="mono">{f.lightTime(alert.oneWay_s)}</b> after it leaves
                  {alert.sendAt > alert.knownAt ? <> (the team needs a few hours to react)</> : null}.
                  {alert.lateIfSent && <span className="bad"> It would arrive after the deadline!</span>}
                </>
              )}
            </div>
            <button type="button" className="btn ghost" onClick={onDefer}>
              Let the craft decide
            </button>
            <button type="button" className="cta" disabled={!pick?.affordable || alert.blockedByConjunction} onClick={() => pick && onSend(pick.id)}>
              <SendIcon />
              Send command
            </button>
          </div>
        </>
      )}

      {stage === 'transit' && inFlight && (
        <div className="ops-alert-body roomy" aria-live="polite">
          <div>
            <div className="ops-label acc">COMMAND ON ITS WAY</div>
            <h2 id="ops-alert-title" className="ops-alert-title">
              {inFlight.label}
            </h2>
            <p className="ops-alert-sit">
              {inFlight.departsIn_s > 0
                ? `The team is checking the command. It leaves Earth in ${f.clock(inFlight.departsIn_s)}, then crosses space at the speed of light.`
                : 'Your craft does not know yet. The message is crossing space at the speed of light.'}
            </p>
          </div>
          <div className="ops-transit">
            <div className="ops-transit-top">
              <span className="muted">Arrives at the craft in</span>
              <span className="ops-countdown mono">{f.clock(inFlight.timeLeft_s)}</span>
            </div>
            <div className="ops-transit-track">
              <span className="ops-end">
                <span className="dot earth" />
                Earth
              </span>
              <span className="ops-track">
                <span className="ops-track-fill" style={{ width: cssPct(inFlight.progress) }} />
                <span className="ops-track-pulse" style={{ left: cssPct(inFlight.progress) }} />
              </span>
              <span className="ops-end">
                <span className="dot craft" />
                Craft
              </span>
            </div>
            {engineer && (
              <div className="ops-eng-line mono">
                t = Δ / c · sent day {f.num(inFlight.sentAt, 4)} → arrives day {f.num(inFlight.arrivesAt, 4)}
              </div>
            )}
          </div>
          <p className="faint">Time runs fast while you wait. Nothing else needs you right now.</p>
        </div>
      )}

      {stage === 'result' && result && (
        <div className="ops-alert-body roomy" aria-live="polite">
          {result.outcome ? (
            <>
              <span className={`chip ${result.outcome.bad ? 'over' : 'ok'}`}>{result.outcome.bad ? 'IT WENT WRONG' : 'IT WORKED'}</span>
              <h2 id="ops-alert-title" className="ops-alert-title">
                {result.outcome.bad ? `Bad luck: ${FAILURE_EFFECT[result.outcome.failureEffect].replace('could', 'did')}` : `${result.outcome.title}: your craft came through.`}
              </h2>
              <p className="ops-alert-sit">
                {result.outcome.by === 'player' ? 'You chose' : result.outcome.by === 'standing-order' ? 'The craft followed its standing order' : 'Fault protection chose'}: {result.outcome.label}.
                {result.outcome.scienceDaysLost > 0 && <> Science paused for {f.days(result.outcome.scienceDaysLost)}.</>}
                {result.outcome.coins > 0 && <> It cost {f.num(result.outcome.coins)} coins.</>}
              </p>
              {engineer && (
                <div className="ops-eng-line mono">
                  science −{f.days(result.outcome.scienceDaysLost)} · budget {f.signedMoney(-result.outcome.budget_M)} · Δv {f.speed(result.outcome.deltaV_ms)}
                </div>
              )}
            </>
          ) : (
            <>
              <h2 id="ops-alert-title" className="ops-alert-title">
                Order received: {result.label}.
              </h2>
              <p className="ops-alert-sit">The craft is ready. You will see how it goes when the hazard arrives.</p>
            </>
          )}
          <button type="button" className="cta" onClick={onResume}>
            Resume mission
          </button>
        </div>
      )}
    </div>
  );
}
