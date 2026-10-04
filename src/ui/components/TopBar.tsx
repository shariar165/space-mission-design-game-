import { DESTINATIONS } from '../../engine/data';
import type { DestinationId } from '../../engine/types';
import { Check, Logo } from './icons';

export type Step = 'map' | 'rescue' | 'build' | 'fly' | 'report';
export type Mode = 'cadet' | 'engineer';

interface StepDef {
  id: string;
  label: string;
  ours?: Step[];
}

const ENGINEER_STEPS: StepDef[] = [
  { id: 'mission', label: 'Mission' },
  { id: 'build', label: 'Build', ours: ['build'] },
  { id: 'fly', label: 'Fly', ours: ['fly'] },
  { id: 'report', label: 'Report', ours: ['report'] },
];

const CADET_STEPS: StepDef[] = [
  { id: 'map', label: 'Map', ours: ['map', 'rescue'] },
  { id: 'build', label: 'Build', ours: ['build'] },
  { id: 'fly', label: 'Fly', ours: ['fly'] },
  { id: 'report', label: 'Report', ours: ['report'] },
];

interface Props {
  step: Step;
  mode: Mode;
  onMode: (m: Mode) => void;
  missionName: string;
  onMissionName: (s: string) => void;
  destination: DestinationId;
  onDestination: (d: DestinationId) => void;
  /** Cadet: go back to the level map. */
  onMap?: () => void;
}

export function TopBar({ step, mode, onMode, missionName, onMissionName, destination, onDestination, onMap }: Props) {
  const cadet = mode === 'cadet';
  const steps = cadet ? CADET_STEPS : ENGINEER_STEPS;
  const currentIdx = steps.findIndex((s) => s.ours?.includes(step));
  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <div>
          <div className="brand-name">SIGNAL DELAY</div>
          <div className="brand-sub">
            <input aria-label="Mission name" value={missionName} size={Math.max(8, missionName.length)} onChange={(e) => onMissionName(e.target.value)} />
            {!cadet && (
              <>
                ·
                <select aria-label="Destination" value={destination} disabled={step !== 'build'} onChange={(e) => onDestination(e.target.value as DestinationId)}>
                  {(Object.keys(DESTINATIONS) as DestinationId[]).map((d) => (
                    <option key={d} value={d}>
                      {DESTINATIONS[d].name} {DESTINATIONS[d].missionType} · {DESTINATIONS[d].difficulty}
                    </option>
                  ))}
                </select>
              </>
            )}
            {cadet && step !== 'map' && step !== 'rescue' && <span>· {DESTINATIONS[destination].name}</span>}
          </div>
        </div>
      </div>
      <nav className="steps" aria-label="Mission steps">
        {steps.map((s, i) => {
          const state = i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'later';
          const built = s.ours !== undefined || s.id === 'mission';
          const dot = <span className="step-dot">{state === 'done' ? <Check /> : i + 1}</span>;
          const back = cadet && s.id === 'map' && step !== 'map' && onMap;
          return (
            <span key={s.id} style={{ display: 'contents' }}>
              {i > 0 && <span className="step-link" />}
              {back ? (
                <button type="button" className={`step ${state} step-btn`} onClick={onMap}>
                  {dot}
                  {s.label}
                </button>
              ) : (
                <span
                  className={`step ${state}${!built && state !== 'current' ? ' later' : ''}`}
                  aria-current={state === 'current' ? 'step' : undefined}
                  title={built ? undefined : 'Coming next: this step is not built yet'}
                >
                  {dot}
                  {s.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>
      <div className="top-right">
        <div className="seg" role="group" aria-label="Mode">
          <button aria-pressed={mode === 'cadet'} onClick={() => onMode('cadet')}>
            Cadet
          </button>
          <button aria-pressed={mode === 'engineer'} onClick={() => onMode('engineer')}>
            Engineer
          </button>
        </div>
      </div>
    </header>
  );
}
