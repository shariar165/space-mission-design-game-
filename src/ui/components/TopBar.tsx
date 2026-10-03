import { DESTINATIONS } from '../../engine/data';
import type { DestinationId } from '../../engine/types';
import { Check, Logo } from './icons';

export type Step = 'build' | 'crisis' | 'debrief';
export type Mode = 'cadet' | 'engineer';

const STEPS: { id: string; label: string; ours?: Step[] }[] = [
  { id: 'mission', label: 'Mission' },
  { id: 'build', label: 'Build', ours: ['build'] },
  { id: 'window', label: 'Window' },
  { id: 'flight', label: 'Flight', ours: ['crisis'] },
  { id: 'debrief', label: 'Debrief', ours: ['debrief'] },
];

interface Props {
  step: Step;
  mode: Mode;
  onMode: (m: Mode) => void;
  missionName: string;
  onMissionName: (s: string) => void;
  destination: DestinationId;
  onDestination: (d: DestinationId) => void;
}

export function TopBar({ step, mode, onMode, missionName, onMissionName, destination, onDestination }: Props) {
  const currentIdx = STEPS.findIndex((s) => s.ours?.includes(step));
  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <div>
          <div className="brand-name">Mission Drafting Table</div>
          <div className="brand-sub">
            <input aria-label="Mission name" value={missionName} size={Math.max(8, missionName.length)} onChange={(e) => onMissionName(e.target.value)} />
            ·
            <select aria-label="Destination" value={destination} disabled={step !== 'build'} onChange={(e) => onDestination(e.target.value as DestinationId)}>
              {(Object.keys(DESTINATIONS) as DestinationId[]).map((d) => (
                <option key={d} value={d}>
                  {DESTINATIONS[d].name} {DESTINATIONS[d].missionType} · {DESTINATIONS[d].difficulty}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <nav className="steps" aria-label="Mission steps">
        {STEPS.map((s, i) => {
          const state = i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'later';
          const built = s.ours !== undefined || s.id === 'mission';
          return (
            <span key={s.id} style={{ display: 'contents' }}>
              {i > 0 && <span className="step-link" />}
              <span
                className={`step ${state}${!built && state !== 'current' ? ' later' : ''}`}
                aria-current={state === 'current' ? 'step' : undefined}
                title={built ? undefined : 'Coming next: this step is not built yet'}
              >
                <span className="step-dot">{state === 'done' ? <Check /> : i + 1}</span>
                {s.label}
              </span>
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
