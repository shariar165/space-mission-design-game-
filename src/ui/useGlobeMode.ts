// 3D or flat Mars globe (spec: UI rule 41). The three.js globe is used when WebGL works and the device is not a
// low-end one; the flat globe otherwise, or when the 3D one drops below the frame-rate floor. The player's toggle
// wins and is saved in the browser.
import { useState } from 'react';
import { loadGlobeMode, saveGlobeMode } from './saves';

export { GLOBE_MIN_FPS, GLOBE_WATCH_MS } from './globeRules';

export function webglAvailable(): boolean {
  try {
    if (typeof document === 'undefined') return false;
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Few cores or little memory: the flat globe by default. */
export function lowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const n = navigator as Navigator & { deviceMemory?: number };
  return (n.hardwareConcurrency !== undefined && n.hardwareConcurrency <= 4) || (n.deviceMemory !== undefined && n.deviceMemory <= 2);
}

export interface GlobeMode {
  mode: '2d' | '3d';
  /** WebGL is there at all (the toggle is offered only then). */
  canDo3d: boolean;
  toggle: () => void;
  /** The 3D globe was too slow or failed: use the flat one for this flight (not saved). */
  fallBack: () => void;
}

export function useGlobeMode(): GlobeMode {
  const [canDo3d] = useState(webglAvailable);
  const [mode, setMode] = useState<'2d' | '3d'>(() => {
    const saved = loadGlobeMode();
    if (!canDo3d) return '2d';
    return saved ?? (lowEndDevice() ? '2d' : '3d');
  });
  return {
    mode,
    canDo3d,
    toggle: () => {
      const next = mode === '3d' ? '2d' : '3d';
      if (next === '3d' && !canDo3d) return;
      saveGlobeMode(next);
      setMode(next);
    },
    fallBack: () => setMode('2d'),
  };
}
