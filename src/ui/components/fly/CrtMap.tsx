// The CRT map (design: Fly & Survive, the green screen). Sun at the centre, the orbits as dashed rings, the path
// flown (solid amber) and still ahead (dashed), the real NASA mission's ghost (dotted green), and while an order is
// on its way, the pulse crawling from Earth to the robot. Positions are engine output in metres, only scaled here.
import type { FlightFrame, FlightMapGeometry, XY } from '../../../engine/flightMap';
import type { DestinationId } from '../../../engine/types';
import { along, MAP_VIEW_DESKTOP, MAP_VIEW_PHONE, projector, ring } from '../../sdGeometry';

interface Props {
  map: FlightMapGeometry;
  frame: FlightFrame;
  trail: XY[];
  ahead: XY[];
  destination: DestinationId;
  destName: string;
  ghost?: { path: XY[]; label: string };
  /** 0–1 along the Earth → robot line while an order travels; undefined when none. */
  pulse?: number;
  /** 0–1 ring phase (the expanding circle around the pulse). */
  ringPhase: number;
  phone: boolean;
  lost: boolean;
}

function Earth({ x, y, big }: { x: number; y: number; big: boolean }) {
  const k = big ? 1.2 : 1;
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k})`}>
      <circle r="14" fill="var(--sd-earth)" />
      <path d="M-9 -4 q4 -7 10 -4 q2 5 -4 7 q-4 1 -6 -3z M2 5 q5 -1 7 3 q-3 4 -8 2z" fill="var(--sd-land)" />
      <text y="34" textAnchor="middle" className="crt-label">
        EARTH
      </text>
    </g>
  );
}

function Planet({ x, y, name, destination, big }: { x: number; y: number; name: string; destination: DestinationId; big: boolean }) {
  const k = big ? 1.25 : 1;
  const mars = destination === 'mars';
  const fill = mars ? 'var(--sd-mars)' : destination === 'venus' ? '#e8c27a' : destination === 'jupiter' ? '#d9a066' : destination === 'moon' ? '#cfcabb' : '#8f8676';
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k})`}>
      <circle r={destination === 'jupiter' ? 16 : destination === 'bennu' ? 7 : 12} fill={fill} />
      {mars && (
        <>
          <circle cx="-4" cy="-2" r="3.5" fill="var(--sd-mars-dark)" />
          <circle cx="4" cy="5" r="2.2" fill="var(--sd-mars-dark)" />
          <path d="M-6 -10 q6 -4 12 0 z" fill="var(--sd-ice)" />
        </>
      )}
      <text y="32" textAnchor="middle" className="crt-label">
        {name.toUpperCase()}
      </text>
    </g>
  );
}

export function Robot({ x, y, scale, lost, label = 'YOU' }: { x: number; y: number; scale: number; lost?: boolean; label?: string }) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale})`} className={lost ? 'crt-robot lost' : 'crt-robot'}>
      <rect x="-27" y="-6" width="17" height="12" fill="var(--sd-panel-blue)" stroke="var(--sd-panel-edge)" strokeWidth="1.2" />
      <rect x="10" y="-6" width="17" height="12" fill="var(--sd-panel-blue)" stroke="var(--sd-panel-edge)" strokeWidth="1.2" />
      <rect x="-8" y="-8" width="16" height="16" rx="2" fill="var(--sd-bus-gold)" stroke="var(--sd-bus-edge)" strokeWidth="1.2" />
      <path d="M-7 -8 q7 -10 14 0 z" fill="var(--sd-paper)" />
      <text y="-20" textAnchor="middle" className="crt-you">
        {label}
      </text>
    </g>
  );
}

export function CrtMap({ map, frame, trail, ahead, destination, destName, ghost, pulse, ringPhase, phone, lost }: Props) {
  const p = projector(map.extent_m);
  const e = p.at(frame.earth);
  const m = p.at(frame.dest);
  const c = p.at(frame.craft);
  const sunFrame = map.frame === 'sun';
  const r = ring(ringPhase);
  const pt = pulse !== undefined ? along(e, c, pulse) : undefined;
  const g = ghost && ghost.path.length > 1 ? p.at(ghost.path[Math.floor(ghost.path.length * 0.7)]!) : undefined;
  return (
    <svg className="crt-map" viewBox={phone ? MAP_VIEW_PHONE : MAP_VIEW_DESKTOP} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Map: your robot on its way to ${destName}`}>
      {!phone && (
        <>
          <line x1="0" y1="300" x2="1000" y2="300" className="crt-axis" />
          <line x1="500" y1="0" x2="500" y2="600" className="crt-axis" />
        </>
      )}
      {map.earthOrbit.length > 0 && <path d={p.d(map.earthOrbit)} className="crt-orbit" />}
      <path d={p.d(map.destOrbit)} className="crt-orbit" />
      {ghost && (
        <g className="crt-ghost">
          <path d={p.d(ghost.path)} />
          {g && !phone && (
            <text x={g[0] + 14} y={g[1] + 26} className="crt-ghost-label">
              {ghost.label}
            </text>
          )}
        </g>
      )}
      {ahead.length > 1 && <path d={p.d(ahead)} className="crt-ahead" />}
      {trail.length > 1 && <path d={p.d(trail)} className="crt-flown" />}
      {sunFrame ? (
        <>
          <circle cx="500" cy="300" r="44" className="crt-sun-glow" />
          <circle cx="500" cy="300" r="30" fill="var(--sd-sun)" />
          <circle cx="500" cy="300" r="23" fill="var(--sd-sun-core)" />
        </>
      ) : null}
      {sunFrame ? <Earth x={e[0]} y={e[1]} big={phone} /> : <Earth x={500} y={300} big={phone} />}
      <Planet x={m[0]} y={m[1]} name={destName} destination={destination} big={phone} />
      {pt && (
        <g className="crt-pulse">
          <line x1={e[0]} y1={e[1]} x2={c[0]} y2={c[1]} className="crt-pulse-line" />
          <circle cx={pt[0]} cy={pt[1]} r={r.r} className="crt-pulse-ring" style={{ strokeOpacity: r.opacity }} />
          <circle cx={pt[0]} cy={pt[1]} r={phone ? 9 : 7} className="crt-pulse-dot" />
        </g>
      )}
      <Robot x={c[0]} y={c[1]} scale={phone ? 1.5 : 1.3} lost={lost} />
    </svg>
  );
}
