// FLY & SURVIVE (Signal Delay design, screen 01; spec UI rules 16–20 and "Signal Delay"). The robot cruises on its
// own; danger cards stop time; you pick; the order flies to the robot at light speed and you wait to hear back.
// One screen for both modes, driven by the Mission operations engine. Every number comes from consoleView
// (ops/console.ts) and the Fly view model (ops/fly.ts); this screen only lays them out.
import { useEffect, useMemo, useState } from 'react';
import { DESTINATIONS, HAZARDS, PARTS } from '../../engine/data';
import { flightMap, ghostFor, pathAhead } from '../../engine/flightMap';
import { comingUp, eclipseCard, flyCard, flyTiles, FLY_RULES, missionProgress, outcomeIn_s, type FlyChip, type OpsState } from '../../engine/ops/index';
import type { Design, Sourced } from '../../engine/types';
import { SPEED_OF_LIGHT } from '../../engine/constants';
import { BookCall } from '../components/ops/BookCall';
import { BlackoutPanel, CommandQueue, ExtensionDecision, NoticeToast, SafeModePanel } from '../components/ops/OpsPanels';
import { PowerDial } from '../components/ops/PowerDial';
import { CrtMap } from '../components/fly/CrtMap';
import { DangerCard, type CardView, type ChipView, type ChoiceView } from '../components/fly/DangerCard';
import { EquationsPanel } from '../components/fly/EquationsPanel';
import { BackButton } from '../components/sd/BackButton';
import { CoachCard } from '../components/sd/CoachCard';
import { MissionBriefing } from '../components/sd/MissionBriefing';
import { ModeLever, type Mode } from '../components/sd/ModeLever';
import { SDIcon } from '../components/sd/SDIcon';
import { Segments } from '../components/sd/Segments';
import { Teletype } from '../components/sd/Teletype';
import { useReducedMotion } from '../opsGeometry';
import { BLOCKER, COMMAND_KIND, eventLine, FAILURE_EFFECT, OPTION_BLURB } from '../opsWords';
import { RIBBON_FLIP, RIBBON_PHONE_MAX, RING_MS, useCycle, useIsPhone } from '../sdGeometry';
import {
  arrivesWords,
  CHIP_ICON,
  COMING,
  EFFECT_ICON,
  endsInWords,
  FINISH_CONFIRM,
  FLY_GOAL,
  GAME_NAME,
  LEAVE_CONFIRM,
  milestoneLine,
  monthsShort,
  monthsWords,
  NAV,
  optionShort,
  playNudge,
  quietLine,
  RESULT_EFFECT_CHIP,
  resultLines,
  TILE,
  type Briefing,
  type TileKey,
} from '../sdWords';
import { OPS_SPEEDS, useOpsSession, type OpsSpeed } from '../useOpsSession';
import * as f from '../format';

interface Props {
  design: Design;
  seed: number;
  mode: Mode;
  onMode: (m: Mode) => void;
  missionName: string;
  onHome: () => void;
  /** The mission is over (complete, lost or never launched): go to the Mission Report. */
  onDone: (s: OpsState) => void;
  /** ◂ BACK: leave the flight (after a confirmation). */
  onBack?: () => void;
  /** Open the "how to fly" coach panels at the start (first flight). */
  coach?: boolean;
  /** The coach panels were closed. */
  onCoachSeen?: () => void;
  /** The mission briefing behind MISSION INFO. */
  brief?: { title: string; briefing: Briefing; concept?: string };
}

type Panel = 'power' | 'call' | 'queue' | 'eqs';
/** Overlays that hold the clock while they are open. */
type Overlay = 'coach' | 'info' | 'finish' | 'leave';

const SPEED_LABEL = (s: OpsSpeed) => (s === 0 ? 'II' : `${f.num(s)}×`);
const SPEED_NAME = (s: OpsSpeed) => (s === 0 ? 'Pause' : `${f.num(s)}× speed`);
const TILE_ORDER: TileKey[] = ['power', 'fuel', 'data', 'systems'];

function chipViews(chips: FlyChip[]): ChipView[] {
  return chips.map((k) => ({ icon: CHIP_ICON[k.gauge], text: k.gauge === 'coins' ? `${f.signedInt(k.delta)} COINS` : f.signedInt(k.delta), tone: 'cost' as const }));
}

export function FlyAndSurvive({ design, seed, mode, onMode, missionName, onHome, onDone, onBack, coach, onCoachSeen, brief }: Props) {
  const engineer = mode === 'engineer';
  const ops = useOpsSession(design, seed);
  const { state, view } = ops;
  const phone = useIsPhone();
  const still = useReducedMotion();
  const dest = DESTINATIONS[design.destination];
  const [panel, setPanel] = useState<Panel>();
  const [lastSpeed, setLastSpeed] = useState<OpsSpeed>(OPS_SPEEDS[2]);
  const [overlay, setOverlay] = useState<Overlay | undefined>(coach ? 'coach' : undefined);
  const [chosen, setChosen] = useState<{ label: string; chips: FlyChip[] }>();
  const [eclipseDone, setEclipseDone] = useState<number[]>([]);
  const ev = state?.env.ev;
  const map = useMemo(() => (ev ? flightMap(design, ev) : undefined), [design, ev]);
  const ghost = useMemo(() => (ev ? ghostFor(design, ev) : undefined), [design, ev]);
  const over = state !== undefined && (state.status === 'complete' || state.status === 'lost' || state.status === 'not-launched');
  const debrief = over;
  const ringPhase = useCycle(RING_MS, !!ops.transit && !still);

  const tiles = state && view ? flyTiles(state, view) : undefined;
  const card = state && view && ops.showAlert ? flyCard(state, view) : undefined;
  const coming = state ? comingUp(state) : undefined;
  const ahead = useMemo(() => (ev && view ? pathAhead(design, view.map.frame.day, ev) : []), [design, ev, view?.map.frame.day]); // eslint-disable-line react-hooks/exhaustive-deps
  const eclipse = state && !ops.showAlert && !ops.transit && !ops.result ? eclipseCard(state) : undefined;
  const eclipseOpen = eclipse !== undefined && !eclipseDone.includes(eclipse.season.startDay);

  // An eclipse planning card or an overlay holds the clock like a danger card does; time runs on when it closes.
  const held = eclipseOpen || overlay !== undefined;
  useEffect(() => {
    ops.setHold(held);
  }, [held]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeOverlay = () => {
    if (overlay === 'coach') onCoachSeen?.();
    setOverlay(undefined);
  };
  const finishMission = () => {
    setOverlay(undefined);
    setPanel(undefined);
    ops.finish();
  };

  const typeOf = (hazardId: string) => state?.hazards.find((h) => h.id === hazardId)?.type ?? '';
  const shortLabel = (hazardId: string, optionId: string) => {
    const type = typeOf(hazardId);
    const o = HAZARDS[type]?.options.find((x) => x.id === optionId);
    return optionShort(type, optionId, o?.label ?? optionId);
  };

  const setSpeed = (s: OpsSpeed) => {
    if (s > 0 && held) return;
    if (s > 0) setLastSpeed(s);
    ops.setSpeed(s);
  };

  // ---- Danger card (hazard) ----
  const respond = (optionId: string) => {
    const o = card?.options.find((x) => x.id === optionId);
    if (!o || !view?.alert) return;
    setChosen({ label: optionShort(view.alert.type, o.id, o.label), chips: o.chips });
    ops.respond(optionId);
  };

  const a = view?.alert;
  const hazardCard: CardView | undefined =
    card && a
      ? {
          icon: a.type === 'solar-storm' ? 'storm' : a.type === 'mars-dust-storm' ? 'dust' : a.type === 'debris' ? 'debris' : a.type === 'insertion-anomaly' ? 'orbit' : 'sys',
          kicker: 'DANGER CARD',
          title: a.title.toUpperCase(),
          line: a.prompt,
          day: `DAY ${f.num(Math.floor(state!.t))}`,
          hits: { k: 'DANGER ARRIVES', v: arrivesWords(card.onsetIn_s) },
          takes: { k: phone ? 'ORDER TAKES' : 'YOUR ORDER TAKES', v: f.durationWords(a.oneWay_s) },
          history: { k: 'REAL HISTORY', s: a.realHistory, ...(a.realHistory.isGameEstimate ? { badge: 'TO VERIFY' } : {}) },
          choices: card.options.map((o): ChoiceView => {
            const chips = chipViews(o.chips);
            if (o.riskIncrease > 0) chips.push({ icon: EFFECT_ICON[o.failureEffect], text: `⚠ +${f.num(o.riskIncrease)} risk`, tone: 'risk', title: `If it fails, ${FAILURE_EFFECT[o.failureEffect]}` });
            const blocked = a.blockedByConjunction || !o.affordable;
            return {
              id: o.id,
              label: optionShort(a.type, o.id, o.label),
              sub: OPTION_BLURB[`${a.type}.${o.id}`] ?? o.label,
              chips,
              eng: `P(fail) ${f.pct(o.failureChance.value, o.failureChance.value < 0.01 ? 2 : 1)} → ${o.failureEffect}${o.cost.deltaV_ms ? ` · Δv ${f.speed(o.cost.deltaV_ms.value)}` : ''}${o.cost.scienceDays ? ` · ${f.days(o.cost.scienceDays.value)} science` : ''}${o.cost.budget_M ? ` · ${f.money(o.cost.budget_M.value, 1)}` : ''}`,
              disabled: blocked,
              ...(a.blockedByConjunction
                ? { blocker: `SUN IN THE WAY: NO ORDERS UNTIL DAY ${f.num(a.retryAfterDay ?? 0)}` }
                : !o.affordable && o.blockedBy[0]
                  ? { blocker: BLOCKER[o.blockedBy[0]].toUpperCase() }
                  : {}),
              ...(o.isFallback ? { tag: a.fallback.by === 'standing-order' ? 'STANDING ORDER' : 'THE ROBOT’S DEFAULT' } : {}),
            };
          }),
          footer: { label: a.blockedByConjunction ? 'LET THE ROBOT DECIDE · TIME RUNS ON' : 'LET THE ROBOT DECIDE', onClick: ops.deferAlert },
        }
      : undefined;

  // ---- Eclipse planning card ----
  const dod = PARTS.power.batteryMaxDepthOfDischarge;
  const eclipseView: CardView | undefined =
    eclipse && eclipseOpen && view
      ? {
          icon: 'eclipse',
          kicker: 'PLAN AHEAD',
          title: 'ECLIPSE SEASON',
          line: `${dest.name} will block the Sun for up to ${f.minutes(eclipse.season.longestEclipse_s)} every orbit. No sun, no power.`,
          day: `DAY ${f.num(Math.floor(state!.t))}`,
          hits: { k: 'DARK SEASON STARTS', v: `IN ${f.num(eclipse.inDays)} ${eclipse.inDays === 1 ? 'DAY' : 'DAYS'}` },
          takes: { k: phone ? 'ORDER TAKES' : 'YOUR ORDER TAKES', v: f.durationWords(view.clock.oneWay_s) },
          history: { k: 'THE RULE', s: { ...dod, value: `Batteries are only drained to ${f.pct(dod.value, 0)} in the dark, so they last for thousands of orbits.` } as Sourced<string> },
          choices: eclipse.options.map((o): ChoiceView => {
            const chips: ChipView[] = [{ icon: 'power', text: `${f.num(o.eclipseSegments)}/${f.num(FLY_RULES.gaugeSegments.value)} IN THE DARK`, tone: o.eclipseSegments <= 1 ? 'cost' : 'info' }];
            if (o.preview.cold) chips.push({ icon: 'heater', text: 'COLD', tone: 'risk', title: 'Cold parts wear out faster' });
            const e = o.preview.eclipse;
            return {
              id: o.id,
              label: o.id === 'keep-warm' ? 'USE BATTERY' : 'SAVE POWER',
              sub: o.id === 'keep-warm' ? 'Keep everything warm.' : 'Turn the heaters down. Shiver.',
              chips,
              ...(e ? { eng: `DoD ${f.pct(e.depthOfDischarge)} of ${f.pct(e.limit, 0)} · heaters ${f.pct(o.plan.heaters, 0)}` } : {}),
              disabled: o.id === 'save-power' && view.blackout.active,
              ...(o.id === 'save-power' && view.blackout.active ? { blocker: 'SUN IN THE WAY: NO ORDERS NOW' } : {}),
            };
          }),
        }
      : undefined;

  const chooseEclipse = (id: string) => {
    if (!eclipse) return;
    const o = eclipse.options.find((x) => x.id === id);
    if (o?.id === 'save-power') ops.sendPlan(o.plan);
    setEclipseDone((d) => [...d, eclipse.season.startDay]);
  };

  const openCard = hazardCard ?? eclipseView;
  const pickCard = (id: string) => (hazardCard ? respond(id) : chooseEclipse(id));

  // Keyboard: ← → ↓ choose on a card; Space pause/resume, 1/2/3 speed, N next event, Esc closes a drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (overlay) return;
      if (openCard) {
        const i = e.key === 'ArrowLeft' ? 0 : e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' ? 2 : -1;
        const c = openCard.choices[i];
        if (c && !c.disabled) {
          e.preventDefault();
          pickCard(c.id);
        }
        return;
      }
      if (e.key === 'Escape') setPanel(undefined);
      else if (e.key === ' ' && !(t instanceof HTMLButtonElement)) {
        e.preventDefault();
        setSpeed(ops.speed === 0 ? lastSpeed : 0);
      } else if (e.key === '1' || e.key === '2' || e.key === '3') setSpeed(OPS_SPEEDS[Number(e.key)]!);
      else if (e.key === 'n' || e.key === 'N') ops.nextEvent();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (ops.error)
    return (
      <div className="sd sd-loading" role="alert">
        <p>MISSION COULD NOT START: {ops.error}</p>
      </div>
    );

  if (!state || !view || !map || !tiles || !coming)
    return (
      <div className="sd sd-loading" aria-busy="true">
        <Teletype text="PREPARING THE MISSION. WORKING OUT EVERY DAY: DISTANCES, LIGHT TIME, ECLIPSES." prefix="> " />
      </div>
    );

  // ---- Signal in flight / result ----
  const flying = ops.transit && view.commands.find((c) => c.status === 'in-flight' && c.hazardId === ops.transit!.hazardId);
  const outcome = ops.result && view.lastOutcome?.hazardId === ops.result.hazardId ? view.lastOutcome : undefined;
  const resultLabel = ops.result ? shortLabel(ops.result.hazardId, ops.result.optionId) : '';
  const resultText = outcome ? resultLines(outcome, resultLabel).map((l) => `> ${l}`).join('\n') : ops.result ? `> ORDER ARRIVED: ${resultLabel}.\n> WAITING TO SEE WHAT HAPPENS.` : '';
  const resultChips: ChipView[] = [...(chosen && ops.result ? chipViews(chosen.chips) : [])];
  if (outcome?.bad) resultChips.push({ icon: EFFECT_ICON[outcome.failureEffect], text: RESULT_EFFECT_CHIP[outcome.failureEffect], tone: 'risk' });
  const deltaOf = (k: TileKey) => (ops.result && chosen ? chosen.chips.find((c) => c.gauge === k)?.delta : undefined);

  const logText = openCard
    ? `${hazardCard ? 'DANGER AHEAD' : 'PLAN AHEAD'}: ${openCard.title}.`
    : flying
      ? `ORDER SENT: ${shortLabel(flying.hazardId!, flying.optionId!)}.`
      : ops.transit
        ? 'ORDER RECEIVED BY THE ROBOT.'
        : ops.result
        ? 'SIGNAL RECEIVED.'
        : (() => {
            const e = view.feed[0];
            const line = e && e.t > state.t - 3 ? eventLine(e, { destName: dest.name, optionLabel: shortLabel }) : undefined;
            return line ? line.toUpperCase() : quietLine(view.clock.phase, dest.name);
          })();

  const awaitingExt = state.status === 'awaiting-extension' && view.extension && !view.extension.decided;
  const lockedUi = ops.locked || held;
  const progress = missionProgress(state);
  const nudge = ops.speed === 0 && !lockedUi && !openCard && !flying && !ops.result && !debrief;
  const g = ghost && { path: ghost.path, label: `${ghost.label.toUpperCase()} · REAL` };
  const arrival = milestoneLine(view.clock.next?.kind, view.clock.next?.inDays, dest.name);
  const segTotal = FLY_RULES.gaugeSegments.value;

  const tileEng: Record<TileKey, string> = {
    power: `${f.signedPct(tiles.power.margin, 0)} · ${f.watts(tiles.power.available_W)}`,
    fuel: f.kg(tiles.fuel.propellantLeft_kg),
    data: `${f.gbit(tiles.data.sent_Gbit)}`,
    systems: `${f.num(tiles.systems.health)}/${f.num(segTotal)}`,
  };
  const tileColor = (k: TileKey) => (tiles[k].low ? 'var(--sd-alarm)' : 'var(--sd-crt-hi)');

  const resources = (
    <div className="fly-tiles" role="list" aria-label="Robot resources">
      {TILE_ORDER.map((k) => {
        const t = tiles[k];
        const d = k === 'fuel' || k === 'data' ? deltaOf(k) : undefined;
        return (
          <div key={k} className={`fly-tile${t.low ? ' low' : ''}`} role="listitem" aria-label={`${TILE[k].name}: ${f.num(t.segments)} of ${f.num(segTotal)}`} title={TILE[k].help}>
            <div className="fly-tile-well">
              <SDIcon icon={TILE[k].icon} size={phone ? 22 : 26} color={tileColor(k)} />
            </div>
            <div className="fly-tile-body">
              <Segments on={t.segments} total={segTotal} color={tileColor(k)} />
              <div className="fly-tile-name">
                <span>{TILE[k].name}</span>
                {engineer && <span className="fly-tile-eng">{tileEng[k]}</span>}
              </div>
            </div>
            {d !== undefined && <span className="fly-tile-delta">{f.signedInt(d)}</span>}
          </div>
        );
      })}
    </div>
  );

  const speeds = (
    <div className={`fly-speeds${nudge ? ' nudge' : ''}`} role="group" aria-label="Time speed">
      {OPS_SPEEDS.map((sp) => (
        <button key={sp} type="button" className="sd-key fly-speed" aria-pressed={ops.speed === sp} aria-label={SPEED_NAME(sp)} disabled={lockedUi && sp !== 0} onClick={() => setSpeed(sp)}>
          {SPEED_LABEL(sp)}
        </button>
      ))}
    </div>
  );

  const ribbon = (
    <div className="fly-ribbon-screen sd-well">
      <div className="fly-ribbon-axis" />
      {coming.ticks.map((t) => (
        <div key={t.inDays} className="fly-tick" style={{ left: `${t.left * 100}%` }}>
          <span className="fly-tick-mark" />
          <span className="fly-tick-txt">{phone ? monthsShort(t.months) : engineer ? `DAY ${f.num(view.clock.day + t.inDays)}` : monthsWords(t.months)}</span>
        </div>
      ))}
      <div className="fly-now" />
      <span className="fly-now-txt">NOW</span>
      {coming.items.map((it, i) => {
        const flip = it.left > RIBBON_FLIP;
        const left = phone ? Math.min(it.left, RIBBON_PHONE_MAX) : it.left;
        const w = COMING[it.kind];
        return (
          <div key={`${it.kind}-${it.day}-${i}`} className={`fly-ev${flip ? ' flip' : ''}${i % 2 ? ' low' : ''}${it.important ? ' important' : ''}`} style={{ left: `${left * 100}%` }}>
            <span className="fly-ev-icon">
              <SDIcon icon={w.icon} size={phone ? 15 : 17} />
            </span>
            <span className="fly-ev-text">
              <span className="fly-ev-label">{phone ? w.short(dest.name) : w.label(dest.name)}</span>
              {!phone && <span className="fly-ev-when">{engineer ? `DAY ${f.num(it.day)} · T−${f.num(it.inDays)} d` : `IN ${f.num(it.inDays)} ${it.inDays === 1 ? 'DAY' : 'DAYS'}`}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );

  const transitBox = flying && (
    <div className="fly-transit" role="status" aria-live="polite">
      {!phone && <span className="fly-transit-k">ORDER “{shortLabel(flying.hazardId!, flying.optionId!)}” IS ON ITS WAY</span>}
      <span className="fly-transit-q">{flying.departsIn_s > 0 ? 'THE TEAM IS WRITING THE ORDER' : phone ? 'ORDER REACHES ROBOT IN' : 'SIGNAL REACHES ROBOT IN'}</span>
      <span className="fly-countdown ops-countdown">{f.mmss(flying.departsIn_s > 0 ? flying.departsIn_s : flying.timeLeft_s)}</span>
      {!phone && <span className="fly-transit-foot">{flying.departsIn_s > 0 ? 'THEN IT CROSSES SPACE AT LIGHT SPEED' : 'NOTHING YOU CAN DO NOW BUT WAIT'}</span>}
    </div>
  );

  const waitFor = !flying && ops.transit ? outcomeIn_s(state, ops.transit.hazardId) : undefined;
  const waitBox = waitFor !== undefined && ops.transit && (
    <div className="fly-transit" role="status" aria-live="polite">
      {!phone && <span className="fly-transit-k">ORDER “{shortLabel(ops.transit.hazardId, ops.transit.optionId)}” CARRIED OUT</span>}
      <span className="fly-transit-q">{HAZARDS[typeOf(ops.transit.hazardId)]?.title.toUpperCase() ?? 'DANGER'} STRIKES IN</span>
      <span className="fly-countdown">{f.mmss(waitFor)}</span>
      {!phone && <span className="fly-transit-foot">THE ROBOT IS READY. HOLD ON.</span>}
    </div>
  );

  const resultBox = ops.result && (
    <div className="fly-result" role="dialog" aria-label="Incoming message">
      <div className="fly-result-head">
        <span>INCOMING · FROM {missionName.toUpperCase()}</span>
        <span>DAY {f.num(Math.floor(state.t))}</span>
      </div>
      <Teletype className="fly-result-text sd-crt-text" text={resultText} />
      <div className="fly-result-foot">
        <span className="dc-chips">
          {resultChips.map((k, i) => (
            <span key={i} className={`sd-chip ${k.tone}`}>
              <SDIcon icon={k.icon} size={18} />
              {k.text}
            </span>
          ))}
        </span>
        <button type="button" className="sd-cta" onClick={ops.dismissResult}>
          CONTINUE ▸
        </button>
      </div>
    </div>
  );

  const actions = !openCard && !flying && !ops.result && !awaitingExt && !debrief && (
    <div className="fly-actions">
      <button type="button" className="fly-action" aria-pressed={panel === 'power'} onClick={() => setPanel((p) => (p === 'power' ? undefined : 'power'))}>
        <SDIcon icon="power" size={16} />
        POWER PLAN
      </button>
      <button type="button" className="fly-action" aria-pressed={panel === 'call'} onClick={() => setPanel((p) => (p === 'call' ? undefined : 'call'))}>
        <SDIcon icon="dish" size={16} />
        CALL HOME
      </button>
      <button type="button" className="fly-action" aria-pressed={panel === 'queue'} aria-label="Command queue" onClick={() => setPanel((p) => (p === 'queue' ? undefined : 'queue'))}>
        <SDIcon icon="share" size={16} />
        ORDERS
      </button>
      {engineer && (
        <button type="button" className="fly-action" aria-pressed={panel === 'eqs'} onClick={() => setPanel((p) => (p === 'eqs' ? undefined : 'eqs'))}>
          EQUATIONS
        </button>
      )}
      <button type="button" className="fly-action" onClick={ops.nextEvent} disabled={lockedUi} aria-label="Next event">
        NEXT EVENT ▸
      </button>
      <button type="button" className="fly-action finish" onClick={() => setOverlay('finish')}>
        {NAV.finish}
      </button>
    </div>
  );

  const drawers = (
    <>
      {!openCard && !flying && !ops.result && <SafeModePanel science={view.science} engineer={engineer} />}
      {!openCard && !flying && !ops.result && !panel && <BlackoutPanel view={view} engineer={engineer} onSkip={ops.skipTo} />}
      {panel === 'power' && (
        <div className="fly-drawer">
          <PowerDial
            state={state}
            engineer={engineer}
            destName={dest.name}
            blocked={view.blackout.active}
            onSend={(p) => {
              ops.sendPlan(p);
              setPanel('queue');
            }}
            onClose={() => setPanel(undefined)}
          />
        </div>
      )}
      {panel === 'call' && (
        <div className="fly-drawer">
          <BookCall
            state={state}
            engineer={engineer}
            onBook={(d, dish, hours) => {
              ops.book(d, dish, hours);
              setPanel(undefined);
            }}
            onClose={() => setPanel(undefined)}
          />
        </div>
      )}
      {panel === 'queue' && (
        <div className="fly-drawer">
          <CommandQueue
            commands={view.commands}
            blackout={view.blackout}
            engineer={engineer}
            optionLabel={(c) => (c.kind === 'respond' && c.hazardId && c.optionId ? shortLabel(c.hazardId, c.optionId) : COMMAND_KIND[c.kind])}
            onClose={() => setPanel(undefined)}
            onPlan={() => setPanel('power')}
            onCall={() => setPanel('call')}
          />
        </div>
      )}
      {panel === 'eqs' && (
        <div className="fly-drawer">
          <EquationsPanel gauges={view.gauges} onClose={() => setPanel(undefined)} />
        </div>
      )}
      {awaitingExt && (
        <div className="fly-drawer wide">
          <ExtensionDecision options={view.extension!.options} engineer={engineer} destName={dest.name} scienceDays={state.scienceDaysAchieved} onChoose={ops.extend} />
        </div>
      )}
      {debrief && (
        <div className="fly-end" role="dialog" aria-label="Mission over">
          <span className="fly-end-k">{state.status === 'lost' ? 'CONTACT LOST' : state.status === 'not-launched' ? 'NOT LAUNCHED' : 'PRIME MISSION COMPLETE'}</span>
          <span className="fly-end-v">{state.status === 'lost' ? 'THE ROBOT WENT SILENT.' : 'THE TELETYPE IS PRINTING YOUR REPORT.'}</span>
          <button type="button" className="sd-cta" onClick={() => onDone(state)}>
            SEE MISSION REPORT ▸
          </button>
        </div>
      )}
      {ops.notice && <NoticeToast notice={ops.notice} onClose={ops.dismissNotice} />}
    </>
  );

  const crt = (
    <main className={`sd-crt fly-crt${view.blackout.active ? ' blackout' : ''}`} aria-label="Mission map">
      <CrtMap
        map={map}
        frame={view.map.frame}
        trail={view.map.trail}
        ahead={ahead}
        destination={design.destination}
        destName={dest.name}
        {...(g ? { ghost: g } : {})}
        {...(flying ? { pulse: flying.progress } : {})}
        ringPhase={ringPhase}
        phone={phone}
        lost={state.status === 'lost'}
      />
      <Teletype className="fly-log sd-crt-text" text={logText} prefix="> " />
      {!phone && <span className="fly-goal">{FLY_GOAL}</span>}
      {!phone && (
        <div className="fly-legend">
          <span>
            <span className="lg-path" />
            YOUR PATH
          </span>
          {g && (
            <span title={`${ghost!.label}: real path, turned to start beside you`}>
              <span className="lg-ghost" />
              REAL NASA PATH
              <span className="sr-only">{`${ghost!.label}: real path, turned to start beside you`}</span>
            </span>
          )}
        </div>
      )}
      {engineer && !phone && (
        <div className="fly-eng-readout">
          <span>SUN DIST r = {f.au(view.clock.sunDistance_m)}</span>
          <span>EARTH DIST d = {f.au(view.clock.earthDistance_m)}</span>
          <span className="amber ops-met">LIGHT TIME t = d / c = {f.mmss(view.clock.oneWay_s)}</span>
          <span className="small">c = {f.num(SPEED_OF_LIGHT.value)} km/s · MET {f.met(state.t)}</span>
        </div>
      )}
      {engineer && phone && (
        <div className="fly-eng-phone">
          t = d / c = {f.au(view.clock.earthDistance_m)} / c = {f.mmss(view.clock.oneWay_s)}
        </div>
      )}
      {transitBox}
      {waitBox}
      {!phone && resultBox}
      {!phone && openCard && <DangerCard card={openCard} engineer={engineer} phone={false} onPick={pickCard} />}
      {actions}
      {drawers}
    </main>
  );

  const progressBar = (
    <div className="fly-progress" role="progressbar" aria-label="Mission progress" aria-valuemin={0} aria-valuemax={1} aria-valuenow={progress.fraction}>
      <div className="fly-progress-bar sd-well">
        <div className="fly-progress-fill" style={{ width: `${progress.fraction * 100}%` }} />
      </div>
      <span className="fly-progress-txt">{nudge ? playNudge(SPEED_LABEL(lastSpeed)) : endsInWords(progress.daysLeft)}</span>
    </div>
  );

  const confirm = (overlay === 'finish' || overlay === 'leave') && (
    <div className="sd-overlay" role="dialog" aria-modal="true" aria-label={overlay === 'finish' ? FINISH_CONFIRM.title : LEAVE_CONFIRM.title}>
      <div className="sd-confirm sd-paper">
        <h2 className="sd-brief-title">{overlay === 'finish' ? FINISH_CONFIRM.title : LEAVE_CONFIRM.title}</h2>
        <p className="sd-brief-job">{overlay === 'finish' ? FINISH_CONFIRM.body : LEAVE_CONFIRM.body}</p>
        <div className="sd-confirm-foot">
          <button type="button" className="sd-ghost-btn" onClick={() => setOverlay(undefined)}>
            {overlay === 'finish' ? FINISH_CONFIRM.no : LEAVE_CONFIRM.stay}
          </button>
          {overlay === 'leave' && onBack && (
            <button type="button" className="sd-ghost-btn" onClick={onBack}>
              {LEAVE_CONFIRM.leave}
            </button>
          )}
          {!debrief && (
            <button type="button" className="sd-cta" onClick={finishMission}>
              {overlay === 'finish' ? FINISH_CONFIRM.yes : LEAVE_CONFIRM.finish}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const overlays = (
    <>
      {overlay === 'coach' && <CoachCard onClose={closeOverlay} />}
      {overlay === 'info' && brief && (
        <MissionBriefing title={brief.title} destination={design.destination} briefing={brief.briefing} {...(brief.concept ? { concept: brief.concept } : {})} onClose={closeOverlay} />
      )}
      {confirm}
    </>
  );

  // Once the mission is over, Back goes on to the report instead of throwing the flight away.
  const back = () => (debrief ? onDone(state) : setOverlay('leave'));

  const helpKeys = (
    <div className="fly-help">
      {brief && (
        <button type="button" className="sd-ghost-btn fly-help-q" aria-label={NAV.info} title={NAV.info} onClick={() => setOverlay('info')}>
          i
        </button>
      )}
      <button type="button" className="sd-ghost-btn fly-help-q" aria-label={NAV.help} title={NAV.help} onClick={() => setOverlay('coach')}>
        ?
      </button>
    </div>
  );

  const brand = (
    <div className="sd-brand">
      <button type="button" className="sd-brand-name" onClick={onHome} aria-label="Signal Delay: home">
        {GAME_NAME}
      </button>
      <span className="sd-brand-sub">
        {missionName.toUpperCase()} · TO {dest.name.toUpperCase()}
      </span>
    </div>
  );

  if (phone)
    return (
      <div className={`sd fly phone${engineer ? ' eng' : ''}`}>
        <div className="fly-status">
          {onBack ? (
            <BackButton onBack={back} />
          ) : (
            <button type="button" className="fly-status-brand" onClick={onHome}>
              {GAME_NAME}
            </button>
          )}
          {helpKeys}
          <ModeLever mode={mode} onMode={onMode} />
        </div>
        {resources}
        {crt}
        <div className="fly-bottom">
          <div className="fly-clock-row">
            <div className="fly-day sd-well" aria-label={`Day ${f.num(view.clock.day)}`}>
              <span className="fly-day-k">DAY</span>
              <span className="fly-day-num ops-day-num">{f.dayPad(view.clock.day)}</span>
            </div>
            {speeds}
          </div>
          {progressBar}
          <div className="fly-ribbon phone">
            <span className="fly-ribbon-title">COMING UP</span>
            {ribbon}
          </div>
        </div>
        {openCard && <DangerCard card={openCard} engineer={engineer} phone onPick={pickCard} />}
        {resultBox}
        {overlays}
      </div>
    );

  return (
    <div className={`sd fly${engineer ? ' eng' : ''}`}>
      <header className="fly-top">
        <div className="fly-top-left">
          {onBack && <BackButton onBack={back} />}
          {brand}
        </div>
        {resources}
        <div className="fly-top-right">
          {helpKeys}
          <ModeLever mode={mode} onMode={onMode} />
        </div>
      </header>
      {crt}
      <footer className="fly-bottom">
        <div className="fly-clock">
          <div className="fly-day sd-well" aria-label={`Day ${f.num(view.clock.day)}`}>
            <span className="fly-day-k">DAY</span>
            <span className="fly-day-num ops-day-num">{f.dayPad(view.clock.day)}</span>
            <span className="fly-arrival">{arrival}</span>
          </div>
          {speeds}
          {progressBar}
        </div>
        <div className="fly-ribbon">
          <div className="fly-ribbon-head">
            <span>COMING UP · YOU CAN SEE THESE ONES COMING</span>
            <span className="dim">NEXT {f.num(coming.months)} MONTHS</span>
          </div>
          {ribbon}
        </div>
      </footer>
      {overlays}
    </div>
  );
}
