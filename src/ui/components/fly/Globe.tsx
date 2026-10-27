// The globe in the CRT (spec: UI rules 41, 44), the hero of Science Targets: Mars or the Moon, from the body record
// (`body`: its map, view and words). It fills its box. The three.js globe when the device can draw it smoothly, the
// flat one otherwise, and a 2D/3D toggle. The 3D globe is its own chunk, loaded when orbit first needs it; the flat globe stands in while it loads, and takes over if WebGL fails or the
// frame rate drops. Both draw the same thing (sdGeometry) and take the same props.
import { Component, lazy, Suspense, type ReactNode } from 'react';
import { useBoxSize } from '../../opsGeometry';
import { bodyWord, GLOBE_WORDS } from '../../sdWords';
import { useGlobeMode } from '../../useGlobeMode';
import type { GlobeProps } from './GlobeMarks';
import { Globe2D } from './Globe2D';

const Globe3D = lazy(() => import('./Globe3D'));

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

export function Globe(p: Omit<GlobeProps, 'w' | 'h'>) {
  const g = useGlobeMode();
  const [ref, box] = useBoxSize<HTMLDivElement>(FALLBACK[p.phone ? 'phone' : 'desktop']);
  const props: GlobeProps = { ...p, w: box.w, h: box.h };
  const flat = <Globe2D {...props} />;
  return (
    <div ref={ref} className={`sci-globe-host ${g.mode}`}>
      {g.mode === '3d' ? (
        <GlobeBoundary fallback={flat} onError={g.fallBack}>
          <Suspense fallback={flat}>
            <Globe3D {...props} onSlow={g.fallBack} />
          </Suspense>
        </GlobeBoundary>
      ) : (
        flat
      )}
      {g.canDo3d && (
        <button type="button" className="sci-globe-toggle" aria-label={GLOBE_WORDS.toggleLabel(bodyWord(p.body))} onClick={g.toggle}>
          {g.mode === '3d' ? GLOBE_WORDS.to2d : GLOBE_WORDS.to3d}
        </button>
      )}
    </div>
  );
}
