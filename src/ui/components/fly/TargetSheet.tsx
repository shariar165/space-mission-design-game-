// The phone's bottom sheet over the Mars globe (Science Targets, spec: UI rule 39): the target list, at three snap
// points (peek: the selected target only; half; full). Drag the handle to move it, or tap it (or press it with the
// keyboard) to step through the snaps. Presentation only.
import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { SHEET_SNAPS, SHEET_TAP_PX, type SheetSnap } from '../../sdGeometry';
import { SCIENCE } from '../../sdWords';

const ORDER: SheetSnap[] = ['peek', 'half', 'full'];

export function TargetSheet({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<SheetSnap>('peek');
  const [drag, setDrag] = useState<number>();
  const box = useRef<HTMLDivElement>(null);
  const start = useRef<{ y: number; frac: number; moved: boolean } | undefined>(undefined);
  /** A drag just ended: the click that follows it is not a tap. */
  const dragged = useRef(false);
  const height = () => box.current?.parentElement?.getBoundingClientRect().height || 1;

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    start.current = { y: e.clientY, frac: SHEET_SNAPS[snap], moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const s = start.current;
    if (!s) return;
    const dy = s.y - e.clientY;
    if (Math.abs(dy) > SHEET_TAP_PX) s.moved = true;
    if (s.moved) setDrag(Math.max(SHEET_SNAPS.peek, Math.min(SHEET_SNAPS.full, s.frac + dy / height())));
  };
  const up = () => {
    const s = start.current;
    start.current = undefined;
    if (!s?.moved || drag === undefined) return;
    dragged.current = true;
    // Settle on the nearest snap.
    const near = ORDER.reduce((a, b) => (Math.abs(SHEET_SNAPS[b] - drag) < Math.abs(SHEET_SNAPS[a] - drag) ? b : a));
    setSnap(near);
    setDrag(undefined);
  };
  const click = () => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    setSnap((x) => ORDER[(ORDER.indexOf(x) + 1) % ORDER.length]!);
  };

  const frac = drag ?? SHEET_SNAPS[snap];
  return (
    <div ref={box} className={`sci-sheet ${snap}${drag !== undefined ? ' dragging' : ''}`} style={{ '--sheet': frac } as CSSProperties} data-snap={snap}>
      <button
        type="button"
        className="sci-sheet-handle"
        aria-label={SCIENCE.sheet}
        aria-expanded={snap !== 'peek'}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={click}
      >
        <span className="sci-sheet-grip" />
        <span className="sci-sheet-more">{snap === 'full' ? SCIENCE.sheetLess : SCIENCE.sheetMore}</span>
      </button>
      <div className="sci-sheet-body">{children}</div>
    </div>
  );
}
