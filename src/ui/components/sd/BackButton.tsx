// ◂ BACK: the same key, top-left, on every step (spec: "UI rules"; the browser Back button does the same).
import { NAV } from '../../sdWords';

export function BackButton({ onBack, label = NAV.back, className = '' }: { onBack: () => void; label?: string; className?: string }) {
  return (
    <button type="button" className={`sd-back ${className}`.trim()} onClick={onBack} aria-label="Back">
      {label}
    </button>
  );
}
