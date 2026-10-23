// The Mars globe in the CRT (spec: UI rule 41): the three.js globe when the device can draw it smoothly, the flat
// one otherwise, and a 2D/3D toggle. The 3D globe is its own chunk, loaded when Mars orbit first needs it; the flat
// globe stands in while it loads, and takes over if WebGL fails or the frame rate drops.
import { Component, lazy, Suspense, type ReactNode } from 'react';
import type { TargetCard } from '../../../engine/ops/index';
import { GLOBE_WORDS } from '../../sdWords';
import { useGlobeMode } from '../../useGlobeMode';
import { MarsGlobe2D } from './MarsGlobe2D';

const MarsGlobe3D = lazy(() => import('./MarsGlobe3D'));

/** A WebGL error in the 3D globe falls back to the flat one. */
class GlobeBoundary extends Component<{ fallback: ReactNode; onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface Props {
  cards: TargetCard[];
  selected?: string;
  onPick?: (id: string) => void;
  size: number;
  shown?: number;
  phone: boolean;
}

export function MarsGlobe(p: Props) {
  const g = useGlobeMode();
  const flat = <MarsGlobe2D cards={p.cards} {...(p.selected ? { selected: p.selected } : {})} {...(p.onPick ? { onPick: p.onPick } : {})} size={p.size} {...(p.shown !== undefined ? { shown: p.shown } : {})} />;
  return (
    <div className={`sci-globe-host ${g.mode}`}>
      {g.mode === '3d' ? (
        <GlobeBoundary fallback={flat} onError={g.fallBack}>
          <Suspense fallback={flat}>
            <MarsGlobe3D {...p} onSlow={g.fallBack} />
          </Suspense>
        </GlobeBoundary>
      ) : (
        flat
      )}
      {g.canDo3d && (
        <button type="button" className="sci-globe-toggle" aria-label={GLOBE_WORDS.toggleLabel} onClick={g.toggle}>
          {g.mode === '3d' ? GLOBE_WORDS.to2d : GLOBE_WORDS.to3d}
        </button>
      )}
    </div>
  );
}
