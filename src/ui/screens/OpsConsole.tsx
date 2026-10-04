// Operations Console (spec UI rules 16–20; design: docs/design/Ops Console Desktop.dc.html and Mobile). The player
// manages the craft they designed, day by day: hazards, light delay, conjunction blackouts, the extension decision.
// The engine simulates (src/engine/ops) and consoleView() gives every number; this screen only lays them out.
import { useEffect, useMemo, useState } from 'react';
import { DESTINATIONS, HAZARDS } from '../../engine/data';
import { flightMap, ghostFor } from '../../engine/flightMap';
import { operationsDebrief, type ConsoleCommand } from '../../engine/ops/index';
import type { Design } from '../../engine/types';
import { ActionDock, type OpsPanel } from '../components/ops/ActionDock';
import { BookCall } from '../components/ops/BookCall';
import { HazardAlert } from '../components/ops/HazardAlert';
import { OpsClockBar } from '../components/ops/OpsClockBar';
import { BlackoutPanel, CommandQueue, ExtensionDecision, NoticeToast, OpsSummary, SafeModePanel } from '../components/ops/OpsPanels';
import { PowerDial } from '../components/ops/PowerDial';
import { ResourceGauges } from '../components/ops/ResourceGauges';
import { UpcomingStrip } from '../components/ops/UpcomingStrip';
import { FlightMapView } from '../components/FlightMapView';
import { useReducedMotion } from '../opsGeometry';
import { COMMAND_KIND, eventLine, SIGNAL_LINE } from '../opsWords';
import { OPS_SPEEDS, useOpsSession, type OpsSpeed } from '../useOpsSession';
import * as f from '../format';

interface Props {
  design: Design;
  seed: number;
  engineer: boolean;
  missionName: string;
  onExit: () => void;
}

export function OpsConsole({ design, seed, engineer, missionName, onExit }: Props) {
  const ops = useOpsSession(design, seed);
  const { state, view } = ops;
  const dest = DESTINATIONS[design.destination];
  const [panel, setPanel] = useState<OpsPanel>();
  const [callDay, setCallDay] = useState<number>();
  const [lastSpeed, setLastSpeed] = useState<OpsSpeed>(1);
  const still = useReducedMotion();
  const ev = state?.env.ev;
  const map = useMemo(() => (ev ? flightMap(design, ev) : undefined), [design, ev]);
  const ghost = useMemo(() => (ev ? ghostFor(design, ev) : undefined), [design, ev]);
  const debrief = useMemo(() => (state && (state.status === 'complete' || state.status === 'lost' || state.status === 'not-launched') ? operationsDebrief(state) : undefined), [state]);

  const optionLabel = (hazardId: string, optionId: string) => {
    const type = state?.hazards.find((h) => h.id === hazardId)?.type;
    return (type && HAZARDS[type]?.options.find((o) => o.id === optionId)?.label) ?? optionId;
  };
  const commandLabel = (c: ConsoleCommand) => (c.kind === 'respond' && c.hazardId && c.optionId ? optionLabel(c.hazardId, c.optionId) : COMMAND_KIND[c.kind]);

  const setSpeed = (s: OpsSpeed) => {
    if (s > 0) setLastSpeed(s);
    ops.setSpeed(s);
  };

  // Keyboard: Space pause/resume, 1/2/3 speed, N next event, Esc closes a side panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
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
      <div className="ops ops-state" role="alert">
        <h1 className="ctitle">Mission operations could not start</h1>
        <p className="muted">{ops.error}</p>
        <button type="button" className="cta" onClick={onExit}>
          Back to the debrief
        </button>
      </div>
    );

  if (!state || !view || !map)
    return (
      <div className="ops ops-state" aria-busy="true">
        <div className="ops-skel" />
        <h1 className="h2">Preparing mission operations…</h1>
        <p className="muted">Working out every day of the mission: distances, light delay, eclipses and the Sun’s position.</p>
      </div>
    );

  const g = ghost && { path: ghost.path, at: ghost.at(view.map.frame.day), label: ghost.label };
  const phase = view.clock.phase;
  const mapTitle =
    phase === 'cruise' || phase === 'launch'
      ? `Earth → ${dest.name} cruise`
      : phase === 'arrival'
        ? `Arriving at ${dest.name}`
        : phase === 'return'
          ? 'Heading home'
          : dest.missionType === 'orbiter'
            ? `In orbit around ${dest.name}`
            : `At ${dest.name}`;
  const flying = ops.transit && view.commands.find((c) => c.status === 'in-flight' && c.hazardId === ops.transit!.hazardId);
  const transitCmd = flying && {
    ...flying,
    label: optionLabel(flying.hazardId!, flying.optionId!),
    title: HAZARDS[state.hazards.find((h) => h.id === flying.hazardId)?.type ?? '']?.title ?? '',
  };
  const outcome = ops.result && view.lastOutcome?.hazardId === ops.result.hazardId ? view.lastOutcome : undefined;
  const resultCard = ops.result && {
    ...ops.result,
    label: optionLabel(ops.result.hazardId, ops.result.optionId),
    title: HAZARDS[state.hazards.find((h) => h.id === ops.result!.hazardId)?.type ?? '']?.title ?? '',
    ...(outcome ? { outcome } : {}),
  };
  const showAlert = !debrief && ((ops.showAlert && view.alert) || transitCmd || resultCard);
  const awaitingExt = state.status === 'awaiting-extension' && view.extension && !view.extension.decided;
  const feed = view.feed.map((e) => ({ e, line: eventLine(e, { destName: dest.name, optionLabel }) })).filter((x) => x.line);

  return (
    <div className={`ops${engineer ? ' eng' : ' cadet-ops'}`}>
      <OpsClockBar
        view={view}
        engineer={engineer}
        destName={dest.name}
        speed={ops.speed}
        locked={ops.locked}
        over={state.status !== 'flying' && state.status !== 'awaiting-extension'}
        transit={!!ops.transit}
        onSpeed={setSpeed}
        onNext={ops.nextEvent}
      />
      <div className="ops-grid">
        <main className="ops-stage" aria-label="Mission map">
          <div className={`ops-map${view.blackout.active || awaitingExt ? ' dim' : ''}`}>
            <FlightMapView
              map={map}
              frame={view.map.frame}
              trail={view.map.trail}
              destination={design.destination}
              destName={dest.name}
              failed={state.status === 'lost'}
              ghost={g}
              signal={view.map.signal}
              still={still}
            />
          </div>
          <div className="ops-map-title">
            <span className="ops-label">{missionName.toUpperCase()} · MAP · TOP-DOWN · TO SCALE</span>
            <span className="ops-map-name">{mapTitle}</span>
          </div>
          <div className="ops-map-legend">
            <span>
              <span className="lg-path" />
              Your path
            </span>
            {g && (
              <span>
                <span className="lg-ghost" />
                {g.label}
              </span>
            )}
            <span>
              <span className={`lg-signal ${view.map.signal}`} />
              {engineer ? `OWLT ${f.lightTime(view.clock.oneWay_s)}` : SIGNAL_LINE[view.map.signal]}
            </span>
          </div>

          {showAlert && (
            <HazardAlert
              {...(ops.showAlert && view.alert ? { alert: view.alert } : {})}
              engineer={engineer}
              {...(transitCmd ? { inFlight: transitCmd } : {})}
              {...(resultCard && !transitCmd ? { result: resultCard } : {})}
              onSend={ops.respond}
              onDefer={ops.deferAlert}
              onResume={ops.dismissResult}
            />
          )}
          {!showAlert && <SafeModePanel science={view.science} engineer={engineer} />}
          {!showAlert && !panel && <BlackoutPanel view={view} engineer={engineer} onSkip={ops.skipTo} />}
          {panel === 'power' && (
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
          )}
          {panel === 'call' && (
            <BookCall
              state={state}
              {...(callDay !== undefined ? { day: callDay } : {})}
              engineer={engineer}
              onBook={(d, dish, hours) => {
                ops.book(d, dish, hours);
                setPanel(undefined);
              }}
              onClose={() => setPanel(undefined)}
            />
          )}
          {panel === 'queue' && (
            <CommandQueue
              commands={view.commands}
              blackout={view.blackout}
              engineer={engineer}
              optionLabel={commandLabel}
              onClose={() => setPanel(undefined)}
              onPlan={() => setPanel('power')}
              onCall={() => {
                setCallDay(undefined);
                setPanel('call');
              }}
            />
          )}
          {awaitingExt && (
            <ExtensionDecision options={view.extension!.options} engineer={engineer} destName={dest.name} scienceDays={state.scienceDaysAchieved} onChoose={ops.extend} />
          )}
          {debrief && <OpsSummary debrief={debrief} destName={dest.name} onExit={onExit} onRestart={ops.restart} />}
          {!awaitingExt && !debrief && !showAlert && (
            <ActionDock
              view={view}
              engineer={engineer}
              {...(panel ? { open: panel } : {})}
              onOpen={(p) => {
                if (p === 'call') setCallDay(undefined);
                setPanel((cur) => (cur === p ? undefined : p));
              }}
            />
          )}
          {ops.notice && <NoticeToast notice={ops.notice} onClose={ops.dismissNotice} />}
        </main>
        <div className="ops-side">
          <ResourceGauges gauges={view.gauges} engineer={engineer} destName={dest.name} />
          <section className="ops-feed" aria-label="Mission log" aria-live="polite">
            <span className="ops-label">MISSION LOG</span>
            <ol>
              {feed.slice(0, 5).map(({ e, line }, i) => (
                <li key={`${e.t}-${e.code}-${i}`}>
                  <span className="mono faint">D{f.num(Math.floor(e.t))}</span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
      <UpcomingStrip
        timeline={view.timeline}
        engineer={engineer}
        destName={dest.name}
        {...(view.blackout.daysLeft !== undefined ? { blackoutDaysLeft: view.blackout.daysLeft } : {})}
        onBook={(day) => {
          setCallDay(day);
          setPanel('call');
        }}
      />
    </div>
  );
}
