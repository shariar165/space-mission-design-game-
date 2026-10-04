// Cadet hero: a colourful spacecraft beside its rocket. Shapes scale with the design (layout only);
// each part is keyed by its size, so a change remounts it and it snaps on with a small bounce.
// The rocket strains (wobbles, shakes) when the weight gauge is tipping or over.
import { DESTINATIONS, LAUNCH_VEHICLES, PARTS } from '../../engine/data';
import type { Design, MeterStatus } from '../../engine/types';

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

const PLANET: Record<Design['destination'], [string, string]> = {
  moon: ['#e8ebf2', '#9aa3b5'],
  venus: ['#ffe2a0', '#d39b3c'],
  mars: ['#ff9b6b', '#b8482a'],
  bennu: ['#a39686', '#5e544b'],
  jupiter: ['#f3d2a2', '#b9783d'],
};

export function CadetCraft({ design, weight, size = 'large' }: { design: Design; weight: MeterStatus; size?: 'large' | 'small' }) {
  const bus = PARTS.buses[design.busId];
  const lv = LAUNCH_VEHICLES[design.launchVehicleId];
  const dest = DESTINATIONS[design.destination];
  const solar = design.power.type === 'solar';
  const area = design.power.arrayArea_m2 ?? 0;
  const rtgs = Math.min(design.power.rtgCount ?? 0, 6);

  // ---- geometry (layout only) ----
  const cx = 250;
  const cy = 200;
  const bw = clamp(84 * Math.sqrt((bus?.mass_kg.value ?? 250) / 250), 84, 136);
  const bh = bw * 0.82;
  const bl = cx - bw / 2;
  const bt = cy - bh / 2;
  const bb = cy + bh / 2;
  const wingL = clamp(30 * Math.sqrt(area / 1.5), 26, 150);
  const wingH = 64;
  const dishR = clamp(24 * design.comms.dishDiameter_m, 22, 82);
  const tankR = clamp(8 + 1.05 * Math.cbrt(design.propellant_kg), 16, 40);
  const tankY = bb + tankR + 2;
  const inst = design.instrumentIds;
  const srb = lv?.name.endsWith('411') ?? false;
  const [p1, p2] = PLANET[design.destination];

  return (
    <svg className={`cadet-craft ${size}`} viewBox="0 0 640 440" role="img" aria-label={`Your spacecraft on a ${lv?.name ?? 'rocket'}, bound for ${dest.name}`}>
      <defs>
        <linearGradient id="cc-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe89a" />
          <stop offset="0.45" stopColor="#f2b33d" />
          <stop offset="1" stopColor="#b97616" />
        </linearGradient>
        <linearGradient id="cc-cell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f7bff" />
          <stop offset="1" stopColor="#1b3fa8" />
        </linearGradient>
        <radialGradient id="cc-dish" cx="0.5" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c9d3e6" />
        </radialGradient>
        <radialGradient id="cc-tank" cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#f4f7ff" />
          <stop offset="1" stopColor="#8b97b1" />
        </radialGradient>
        <linearGradient id="cc-rocket" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b8642a" />
          <stop offset="0.5" stopColor="#f0a35e" />
          <stop offset="1" stopColor="#a8551f" />
        </linearGradient>
        <radialGradient id="cc-planet" cx="0.35" cy="0.35" r="0.8">
          <stop offset="0" stopColor={p1} />
          <stop offset="1" stopColor={p2} />
        </radialGradient>
        <radialGradient id="cc-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffb35c" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ff6a2b" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Destination, far away */}
      <g className="cc-planet">
        <circle cx="70" cy="70" r="34" fill="url(#cc-planet)" />
        {design.destination === 'jupiter' && <path d="M38 64 Q70 58 102 64 M38 78 Q70 72 102 78" stroke="#a5652e" strokeWidth="4" fill="none" opacity="0.6" />}
        {design.destination === 'mars' && <circle cx="58" cy="60" r="7" fill="#9c3b22" opacity="0.5" />}
      </g>

      {/* Power: solar wings or RTGs */}
      {solar ? (
        <g key={`solar-${Math.round(area * 2)}`} className="snap">
          {[-1, 1].map((side) => {
            const x0 = side < 0 ? bl - 14 - wingL : bl + bw + 14;
            const cells = Math.max(2, Math.floor(wingL / 16));
            return (
              <g key={side}>
                <rect x={side < 0 ? bl - 14 : bl + bw} y={cy - 3} width="14" height="6" fill="#c7cfdf" />
                <rect x={x0} y={cy - wingH / 2} width={wingL} height={wingH} rx="4" fill="url(#cc-cell)" stroke="#dfe7ff" strokeWidth="2" />
                {Array.from({ length: cells - 1 }, (_, i) => (
                  <path key={i} d={`M${x0 + ((i + 1) * wingL) / cells} ${cy - wingH / 2} v${wingH}`} stroke="#8fb4ff" strokeOpacity="0.55" strokeWidth="1.2" />
                ))}
                <path d={`M${x0} ${cy} h${wingL}`} stroke="#8fb4ff" strokeOpacity="0.55" strokeWidth="1.2" />
              </g>
            );
          })}
        </g>
      ) : (
        <g key={`rtg-${rtgs}`} className="snap">
          <path d={`M${bl} ${bb - 12} L${bl - 34} ${bb + 18}`} stroke="#c7cfdf" strokeWidth="4" />
          {Array.from({ length: Math.max(1, rtgs) }, (_, i) => {
            const x = bl - 66 - (i % 3) * 30;
            const y = bb + 6 + Math.floor(i / 3) * 62;
            return (
              <g key={i}>
                <circle cx={x + 11} cy={y + 26} r="24" fill="url(#cc-glow)" className="rtg-glow" />
                <rect x={x} y={y} width="22" height="52" rx="6" fill="#3b4256" stroke="#7d8aa8" strokeWidth="1.5" />
                {[10, 20, 30, 40].map((dy) => (
                  <path key={dy} d={`M${x - 5} ${y + dy} h32`} stroke="#7d8aa8" strokeWidth="2" />
                ))}
              </g>
            );
          })}
        </g>
      )}

      {/* High-gain dish on top */}
      <g key={`dish-${design.comms.dishDiameter_m}`} className="snap">
        <path d={`M${cx} ${bt} V${bt - 26}`} stroke="#c7cfdf" strokeWidth="4" />
        <path d={`M${cx - dishR} ${bt - 30} Q${cx} ${bt - 30 + dishR * 0.55} ${cx + dishR} ${bt - 30} Z`} fill="url(#cc-dish)" stroke="#ffffff" strokeWidth="2" />
        <path d={`M${cx} ${bt - 28} L${cx} ${bt - 30 - dishR * 0.5}`} stroke="#9aa6bf" strokeWidth="2" />
        <circle cx={cx} cy={bt - 32 - dishR * 0.5} r="4" fill="#ff9f57" />
      </g>

      {/* Fuel tank and engine bell under the bus */}
      <g key={`tank-${Math.round(design.propellant_kg / 100)}`} className="snap">
        <circle cx={cx} cy={tankY} r={tankR} fill="url(#cc-tank)" stroke="#e8edf7" strokeWidth="2" />
        <path d={`M${cx - tankR * 0.8} ${tankY + tankR * 0.2} A${tankR} ${tankR} 0 0 0 ${cx + tankR * 0.8} ${tankY + tankR * 0.2} Z`} fill="#ff9f57" opacity="0.75" />
        <path d={`M${cx - 10} ${tankY + tankR} L${cx + 10} ${tankY + tankR} L${cx + 18} ${tankY + tankR + 26} L${cx - 18} ${tankY + tankR + 26} Z`} fill="#5d6680" stroke="#9aa6bf" strokeWidth="1.5" />
      </g>

      {/* Bus: gold foil box */}
      <g key={`bus-${design.busId}`} className="snap">
        <rect x={bl} y={bt} width={bw} height={bh} rx="10" fill="url(#cc-gold)" stroke="#fff3c4" strokeWidth="2" />
        <path d={`M${bl + 12} ${bt + 16} l${bw * 0.3} ${bh * 0.2} M${bl + bw * 0.55} ${bt + 12} l${bw * 0.3} ${bh * 0.35} M${bl + 18} ${bb - 20} l${bw * 0.4} -${bh * 0.12}`} stroke="#fff6cf" strokeOpacity="0.6" strokeWidth="2" />
      </g>

      {/* Instruments on the front face */}
      {inst.map((id, i) => {
        const x = bl + 14 + (i % 3) * ((bw - 28) / 3);
        const y = cy + 2 + Math.floor(i / 3) * 26;
        return (
          <g key={`inst-${id}`} className="snap">
            <Instrument id={id} x={x} y={y} />
          </g>
        );
      })}

      {/* Rocket on the pad */}
      <g className={`rocket ${weight}`} transform="translate(520 40)">
        <g className="rocket-body">
          <path d="M0 70 Q24 -6 48 70 Z" fill="#f4f6fb" stroke="#ccd3e3" strokeWidth="2" />
          <circle cx="24" cy="48" r="7" fill="url(#cc-gold)" />
          <rect x="0" y="70" width="48" height="250" rx="4" fill="url(#cc-rocket)" />
          <path d="M0 150 h48 M0 230 h48" stroke="#8a4518" strokeOpacity="0.5" strokeWidth="2" />
          {srb && <rect x="-16" y="210" width="14" height="110" rx="6" fill="#eef1f7" stroke="#c4cbdb" strokeWidth="1.5" />}
          <path d="M6 320 L-4 346 H52 L42 320 Z" fill="#3b4256" />
          <path className="flame" d="M6 346 Q24 400 42 346 Z" fill="#ffb347" />
        </g>
      </g>
      <path d="M470 388 H640" stroke="#41507a" strokeWidth="3" />
      {bus && (
        <text x={cx} y="430" textAnchor="middle" className="cc-caption">
          {bus.name}
        </text>
      )}
    </svg>
  );
}

function Instrument({ id, x, y }: { id: string; x: number; y: number }) {
  switch (id) {
    case 'camera':
      return (
        <g>
          <rect x={x} y={y} width="24" height="20" rx="4" fill="#7c5cff" />
          <circle cx={x + 12} cy={y + 10} r="6" fill="#1b1340" stroke="#c9bbff" strokeWidth="2" />
        </g>
      );
    case 'spectrometer':
      return (
        <g>
          <rect x={x} y={y} width="24" height="20" rx="4" fill="#14b8a6" />
          <path d={`M${x + 4} ${y + 14} l5 -8 l5 8 l5 -8`} stroke="#e6fffb" strokeWidth="2" fill="none" />
        </g>
      );
    case 'magnetometer':
      return (
        <g>
          <path d={`M${x + 12} ${y + 10} l-40 30`} stroke="#c7cfdf" strokeWidth="3" />
          <circle cx={x - 28} cy={y + 40} r="7" fill="#f472b6" />
          <rect x={x} y={y} width="24" height="20" rx="4" fill="#db2777" />
        </g>
      );
    case 'radar':
      return (
        <g>
          <rect x={x - 2} y={y} width="30" height="20" rx="3" fill="#22c55e" />
          <path d={`M${x + 2} ${y + 5} h22 M${x + 2} ${y + 10} h22 M${x + 2} ${y + 15} h22`} stroke="#dcfce7" strokeWidth="1.5" />
        </g>
      );
    default:
      return (
        <g>
          <rect x={x} y={y} width="24" height="20" rx="4" fill="#f59e0b" />
          <circle cx={x + 8} cy={y + 10} r="4" fill="#fff7e6" />
          <circle cx={x + 17} cy={y + 10} r="3" fill="#fff7e6" />
        </g>
      );
  }
}
