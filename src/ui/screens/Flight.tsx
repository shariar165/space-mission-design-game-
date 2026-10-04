// Cadet Flight screen: the craft flies the engine's frames on the map. On the crisis day the flight
// pauses for Mission Control; the outcome is the one simulateMission() computed with the standing
// orders, because the craft acts on its own before Earth can answer.
import { useEffect, useMemo, useState } from 'react';
import { DESTINATIONS } from '../../engine/data';
import { flightFrames, flightMap, ghostFor, signalDelay } from '../../engine/flightMap';
import type { FullEvaluation, SimulationResult } from '../../engine/index';
import type { Design } from '../../engine/types';
import { PHASE_NAME } from '../cadetWords';
import { FlightMapView } from '../components/FlightMapView';
import { MissionControl } from '../components/MissionControl';
import { StatusIcon } from '../components/icons';
import * as f from '../format';
import type { CrisisCard, CrisisOption } from '../../engine/crisis';

/** The whole flight plays in about nine seconds, plus the crisis pause. */
export const FLIGHT_MS = 9000;

interface Props {
  design: Design;
  ev: FullEvaluation;
  sim: SimulationResult;
  /** The drawn crisis card and the options that were open (from previewCrisis). */
  crisis?: { card: CrisisCard; options: CrisisOption[] };
  missionName: string;
  onDone: () => void;
}

export function Flight({ design, ev, sim, crisis, missionName, onDone }: Props) {
  const dest = DESTINATIONS[design.destination];
  const map = useMemo(() => flightMap(design, ev), [design, ev]);
  const crisisDay = sim.crisis?.reached ? sim.crisis.day : undefined;
  const frames = useMemo(() => flightFrames(design, { endDay: sim.endDay, crisisDay }, ev), [design, ev, sim.endDay, crisisDay]);
  const [i, setI] = useState(0);
  const [handled, setHandled] = useState(false);
  const frame = frames[i]!;
  const atCrisis = crisisDay !== undefined && frame.day === crisisDay && !handled;
  const done = i >= frames.length - 1;

  useEffect(() => {
    if (done || atCrisis) return;
    const t = setTimeout(() => setI(i + 1), FLIGHT_MS / frames.length);
    return () => clearTimeout(t);
  }, [i, done, atCrisis, frames.length]);

  const signal = useMemo(() => (crisisDay !== undefined ? signalDelay(design, crisisDay, ev) : undefined), [design, crisisDay, ev]);
  const trail = useMemo(() => frames.slice(0, i + 1).map((x) => x.craft), [frames, i]);
  const failed = done && sim.failedPhase !== undefined;
  const order = crisis?.card.options.find((o) => o.id === sim.crisis?.optionId);
  const ghost = useMemo(() => ghostFor(design, ev), [design, ev]);
  const g = ghost && { path: ghost.path, at: ghost.at(frame.day), label: ghost.label };

  return (
    <div className="cadet flight">
      <div className="flight-grid">
        <section className="map-wrap" aria-label="Flight map">
          <FlightMapView map={map} frame={frame} trail={trail} destination={design.destination} destName={dest.name} failed={failed} ghost={g} />
          {g && (
            <div className="ghost-legend">
              <span className="ghost-swatch" aria-hidden="true" /> {g.label}: real path, turned to start beside you
            </div>
          )}
        </section>
        <section className="hud" aria-label="Flight status">
          <div className="ckicker">{missionName}</div>
          <h1 className="ctitle">
            Day <span className="mono">{f.num(frame.day)}</span>
          </h1>
          <div className="hud-phase">
            {sim.totalPhases > 0 &&
              ev.details.phaseRisks.map((p, k) => {
                const passed = (done && !failed) || ev.details.phaseRisks.findIndex((x) => x.phase === frame.phase) > k;
                const lost = failed && sim.failedPhase === p.phase;
                return (
                  <span key={p.phase} className={`hud-step${frame.phase === p.phase ? ' now' : ''}${passed ? ' passed' : ''}${lost ? ' lost' : ''}`}>
                    {passed && <StatusIcon status="ok" size={12} />}
                    {lost && <StatusIcon status="over" size={12} />}
                    {PHASE_NAME[p.phase]}
                  </span>
                );
              })}
          </div>
          <dl className="hud-stats">
            <div>
              <dt>From Earth</dt>
              <dd className="mono">{f.distance(frame.earthDistance_m)}</dd>
            </div>
            <div>
              <dt>Signal delay</dt>
              <dd className="mono">{f.clock(frame.oneWay_s)}</dd>
            </div>
          </dl>
          {ghost && (
            <div className="ghost-race" aria-label="Race against the real mission">
              <span>
                <span className="ghost-dot you" aria-hidden="true" /> You: <b className="mono">{f.days(ev.trajectory.flightDays)}</b> to {dest.name}
              </span>
              <span>
                <span className="ghost-dot" aria-hidden="true" /> {ghost.label}: <b className="mono">{f.days(ghost.flightDays)}</b>
              </span>
            </div>
          )}
          {done ? (
            <div className={`hud-result ${failed ? 'bad' : 'good'}`} aria-live="polite">
              {failed ? `Lost during ${PHASE_NAME[sim.failedPhase!].toLowerCase()}.` : sim.completed ? 'Mission complete!' : 'Flight over.'}
            </div>
          ) : (
            <p className="chelper">{frame.phase === 'cruise' ? `Cruising to ${dest.name}…` : frame.phase === 'science' ? 'Taking photos and sending them home…' : `${PHASE_NAME[frame.phase]}…`}</p>
          )}
          <div className="cnav">
            {!done && (
              <button type="button" className="btn-big ghost" onClick={() => setI(handled || crisisDay === undefined ? frames.length - 1 : frames.findIndex((x) => x.day === crisisDay))}>
                Skip ahead
              </button>
            )}
            {done && (
              <button type="button" className="btn-big" onClick={onDone}>
                See debrief →
              </button>
            )}
          </div>
        </section>
      </div>
      {atCrisis && crisis && order && signal && sim.crisis && (
        <MissionControl
          card={crisis.card}
          day={sim.crisis.day}
          phase={sim.crisis.phase}
          destName={dest.name}
          signal={signal}
          order={order}
          others={crisis.options.filter((o) => o.id !== order.id)}
          onContinue={() => setHandled(true)}
        />
      )}
    </div>
  );
}
