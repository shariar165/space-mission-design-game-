// The Mars globe in the CRT (spec: UI rule 41), the hero of Science Targets: it fills its box. The three.js globe
// when the device can draw it smoothly, the flat one otherwise, and a 2D/3D toggle. The 3D globe is its own chunk,
// loaded when Mars orbit first needs it; the flat globe stands in while it loads, and takes over if WebGL fails or the
// frame rate drops. Both draw the same thing (sdGeometry) and take the same props.
import { Component, lazy, Suspense, type ReactNode } from 'react';
import { useBoxSize } from '../../opsGeometry';
import { GLOBE_WORDS } from '../../sdWords';
import { useGlobeMode } from '../../useGlobeMode';
import type { GlobeProps } from './GlobeMarks';
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

/** Before the box is measured (and in tests): a desktop CRT's globe area, or a phone's. */
const FALLBACK = { desktop: { w: 760, h: 560 }, phone: { w: 370, h: 420 } } as const;

export function MarsGlobe(p: Omit<GlobeProps, 'w' | 'h'>) {
  const g = useGlobeMode();
  const [ref, box] = useBoxSize<HTMLDivElement>(FALLBACK[p.phone ? 'phone' : 'desktop']);
  const props: GlobeProps = { ...p, w: box.w, h: box.h };
  const flat = <MarsGlobe2D {...props} />;
  return (
    <div ref={ref} className={`sci-globe-host ${g.mode}`}>
      {g.mode === '3d' ? (
        <GlobeBoundary fallback={flat} onError={g.fallBack}>
          <Suspense fallback={flat}>
            <MarsGlobe3D {...props} onSlow={g.fallBack} />
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
