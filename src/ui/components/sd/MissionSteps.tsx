// PACK — FLY — REPORT progress (design: Pack header). Engineer mode builds in the Build Bay instead of packing.
import * as f from '../../format';

const STEPS = ['PACK', 'FLY', 'REPORT'] as const;

export function MissionSteps({ at, first = 'PACK' }: { at: 0 | 1 | 2; first?: 'PACK' | 'BUILD' }) {
  return (
    <ol className="pk-steps" aria-label="Mission steps">
      {STEPS.map((s, i) => (
        <li key={s} className={i === at ? 'on' : i < at ? 'done' : ''} aria-current={i === at ? 'step' : undefined}>
          {i > 0 && <span className="pk-step-line" aria-hidden="true" />}
          <span className="pk-step-dot" />
          <span className="pk-step-num">{f.num(i + 1)}</span>
          {i === 0 ? first : s}
        </li>
      ))}
    </ol>
  );
}
