// The flight map: orbits, the transfer path, the craft and the planets on the current frame. Positions
// are engine output (flightMap, flightFrames); this only scales metres into the drawing.
import type { FlightFrame, FlightMapGeometry, XY } from '../../engine/flightMap';
import type { DestinationId } from '../../engine/types';

const DEST_COLOR: Record<DestinationId, string> = { moon: '#d7dce6', venus: '#f3c873', mars: '#ff7a4d', bennu: '#a39686', jupiter: '#e8b77d' };

interface Props {
  map: FlightMapGeometry;
  frame: FlightFrame;
  trail: XY[];
  destination: DestinationId;
  destName: string;
  failed?: boolean;
  /** Faint path of the real mission, if there is one (Mars, Bennu). */
  ghost?: { path: XY[]; at?: XY; label: string };
}

export function FlightMapView({ map, frame, trail, destination, destName, failed, ghost }: Props) {
  const s = 92 / map.extent_m;
  const pt = (p: XY) => `${(p[0] * s).toFixed(2)},${(-p[1] * s).toFixed(2)}`;
  const line = (ps: XY[]) => ps.map(pt).join(' ');
  const at = (p: XY) => ({ cx: p[0] * s, cy: -p[1] * s });
  return (
    <svg className="flight-map" viewBox="-100 -100 200 200" role="img" aria-label={`Flight map: your craft on its way to ${destName}`}>
      <defs>
        <radialGradient id="fm-sun">
          <stop offset="0" stopColor="#fff6c8" />
          <stop offset="0.5" stopColor="#ffc94a" />
          <stop offset="1" stopColor="#ff9a2e" stopOpacity="0" />
        </radialGradient>
      </defs>
      {map.frame === 'sun' ? <circle cx="0" cy="0" r="9" fill="url(#fm-sun)" /> : <circle cx="0" cy="0" r="5" fill="#3f7bff" />}
      {map.earthOrbit.length > 0 && <polyline points={line(map.earthOrbit)} className="fm-orbit earth" />}
      <polyline points={line(map.destOrbit)} className="fm-orbit dest" />
      {ghost && (
        <g className="fm-ghost">
          <polyline points={line(ghost.path)} />
          {ghost.at && <circle {...at(ghost.at)} r="2.4" />}
        </g>
      )}
      <polyline points={line(map.path)} className="fm-path" />
      <polyline points={line(trail)} className="fm-trail" />
      {map.frame === 'sun' && <circle {...at(frame.earth)} r="3.2" fill="#4c8dff" stroke="#cfe0ff" strokeWidth="0.6" />}
      <circle {...at(frame.dest)} r={destination === 'jupiter' ? 5 : 3.4} fill={DEST_COLOR[destination]} />
      <g className={`fm-craft${failed ? ' failed' : ''}`} transform={`translate(${frame.craft[0] * s} ${-frame.craft[1] * s})`}>
        <circle r="5" className="fm-craft-glow" />
        <circle r="2.2" fill={failed ? '#ff6b8a' : '#ffffff'} />
      </g>
    </svg>
  );
}
