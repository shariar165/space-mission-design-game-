// Centre of Build Bay: a blueprint front elevation of the craft. Shapes scale with the design (layout
// only); every mass in the callouts and legend is from evaluateDesign().details.massBreakdown.
import { useState, type DragEvent, type ReactNode } from 'react';
import { GAME_RULES } from '../../engine/constants';
import { DESTINATIONS, LAUNCH_VEHICLES, PARTS } from '../../engine/data';
import type { FullEvaluation } from '../../engine/index';
import type { Design } from '../../engine/types';
import { getDragPayload, type PartPayload, type SlotKind } from '../designOps';
import * as f from '../format';

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

interface Props {
  design: Design;
  ev: FullEvaluation;
  dragKind?: SlotKind;
  onDrop: (p: PartPayload) => void;
}

export function CraftDrawing({ design, ev, dragKind, onDrop }: Props) {
  const m = ev.details.massBreakdown;
  const dest = DESTINATIONS[design.destination];
  const bus = PARTS.buses[design.busId];
  const engine = PARTS.engines[design.engineId];
  const lv = LAUNCH_VEHICLES[design.launchVehicleId];
  const solar = design.power.type === 'solar';

  // ---- geometry (layout only) ----
  const cx = 400;
  const cy = 220;
  const bw = clamp(100 * Math.sqrt(m.bus / 250), 100, 190);
  const bh = bw * 0.9;
  const bl = cx - bw / 2;
  const bt = cy - bh / 2;
  const br = cx + bw / 2;
  const bb = cy + bh / 2;
  const tankR = clamp(8 + 1.0 * Math.cbrt(design.propellant_kg), 8, bw / 4 - 4);
  const wingL = clamp(40 * Math.sqrt((design.power.arrayArea_m2 ?? 0) / 2), 16, 250);
  const wingH = 64;
  const dishRx = clamp(22 * design.comms.dishDiameter_m, 12, 110);
  const rtgN = Math.min(design.power.rtgCount ?? 0, 8);
  const inst = design.instrumentIds;
  const boxH = 30;
  const boxW = 48;
  const boxGap = 10;
  const instY = bb + 64;
  const instX = (i: number) => cx + 40 + i * (boxW + boxGap);

  const glow = (k: SlotKind) => dragKind === k;
  const n = { hga: 1, power: 2, battery: 3, tanks: 4, engine: 5, firstInst: 6 };

  return (
    <main className="drawing" aria-label="Spacecraft drawing">
      <svg viewBox="0 0 800 560" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Front view of the ${bus?.name ?? 'craft'}`}>
        <g fill="none" style={{ stroke: 'var(--bp)' }} strokeWidth="1.5">
          {/* High-gain antenna */}
          <path d={`M${cx} ${bt} V${bt - 46}`} />
          <ellipse cx={cx} cy={bt - 52} rx={dishRx} ry={dishRx * 0.32} style={{ fill: 'rgba(142,197,255,0.08)' }} />
          <path d={`M${cx} ${bt - 52} L${cx} ${bt - 52 - dishRx * 0.45}`} strokeDasharray="3 3" />

          {/* Power: solar wings or RTGs (slot) */}
          <Slot kind="power" glow={glow('power')} onDrop={onDrop}>
            {solar ? (
              <>
                {[-1, 1].map((side) => {
                  const x0 = side < 0 ? bl - 18 - wingL : br + 18;
                  return (
                    <g key={side}>
                      <path d={side < 0 ? `M${bl} ${cy} H${bl - 18}` : `M${br} ${cy} H${br + 18}`} />
                      <rect x={x0} y={cy - wingH / 2} width={wingL} height={wingH} style={{ fill: 'rgba(142,197,255,0.12)' }} />
                      {Array.from({ length: Math.max(1, Math.floor(wingL / 18)) }, (_, i) => (
                        <path key={i} d={`M${x0 + (i + 1) * (wingL / (Math.floor(wingL / 18) + 1))} ${cy - wingH / 2} v${wingH}`} strokeWidth="0.8" />
                      ))}
                      <path d={`M${x0} ${cy} h${wingL}`} strokeWidth="0.8" />
                    </g>
                  );
                })}
              </>
            ) : (
              <>
                <path d={`M${bl} ${bb - 10} L${bl - 40} ${bb + 30}`} />
                {Array.from({ length: Math.max(1, rtgN) }, (_, i) => (
                  <rect key={i} x={bl - 70 - i * 26} y={bb + 24 + (i % 2) * 8} width="20" height="46" rx="4" style={{ fill: 'rgba(255,159,87,0.15)', stroke: 'var(--acc)' }} />
                ))}
              </>
            )}
          </Slot>

          {/* Bus (slot) with tanks and battery inside */}
          <Slot kind="bus" glow={glow('bus')} onDrop={onDrop}>
            <rect x={bl} y={bt} width={bw} height={bh} rx="3" style={{ fill: 'rgba(14,27,59,0.9)' }} />
          </Slot>
          <circle cx={cx - bw / 4} cy={cy + 6} r={tankR} />
          <circle cx={cx + bw / 4} cy={cy + 6} r={tankR} />
          <rect x={cx - 14} y={bt + 10} width="28" height="14" rx="2" strokeWidth="1" />

          {/* Engine (slot) */}
          <Slot kind="engine" glow={glow('engine')} onDrop={onDrop}>
            {engine?.canCapture === false ? (
              <circle cx={cx} cy={bb + 22} r="18" style={{ fill: 'rgba(142,197,255,0.08)' }} />
            ) : (
              <path d={`M${cx - 14} ${bb} L${cx + 14} ${bb} L${cx + 24} ${bb + 36} L${cx - 24} ${bb + 36} Z`} style={{ fill: 'rgba(142,197,255,0.08)' }} />
            )}
          </Slot>

          {/* Instruments on a platform under the bus, plus one open slot */}
          <path d={`M${br - 10} ${bb} V${instY - 10} H${instX(inst.length) + boxW}`} />
          {inst.map((id, i) => (
            <rect key={id} x={instX(i)} y={instY} width={boxW} height={boxH} rx="3" style={{ fill: 'rgba(142,197,255,0.1)' }} />
          ))}
          <Slot kind="instrument" glow={glow('instrument')} onDrop={onDrop}>
            <rect x={instX(inst.length)} y={instY} width={boxW} height={boxH} rx="3" strokeDasharray="5 4" />
          </Slot>

          {/* Launcher pad (slot) */}
          <Slot kind="launcher" glow={glow('launcher')} onDrop={onDrop}>
            <rect x="24" y="400" width="150" height="40" rx="8" strokeDasharray="5 4" />
          </Slot>
        </g>

        {/* Callout numbers */}
        <g style={{ fill: 'var(--bp)' }} fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="600" textAnchor="middle">
          <Callout x={cx + dishRx + 14} y={bt - 52} n={n.hga} />
          <Callout x={solar ? bl - 18 - wingL / 2 : bl - 60} y={solar ? cy - wingH / 2 - 14 : bb + 90} n={n.power} />
          <Callout x={cx} y={bt + 40} n={n.battery} />
          <Callout x={cx - bw / 4} y={cy + 6 + tankR + 14} n={n.tanks} />
          <Callout x={cx + 38} y={bb + 26} n={n.engine} />
          {inst.map((id, i) => (
            <Callout key={id} x={instX(i) + boxW / 2} y={instY + boxH + 20} n={n.firstInst + i} />
          ))}
        </g>
        <text x="99" y="424" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="600" style={{ fill: 'var(--ink2)' }}>
          {lv?.name ?? design.launchVehicleId}
        </text>
      </svg>

      <div className="drawing-title">
        <div className="mono muted" style={{ fontSize: 11, letterSpacing: '0.08em' }}>
          DRAWING · FRONT ELEVATION
        </div>
        <div className="big">
          {bus?.name ?? design.busId} · {dest.name} {dest.missionType}
        </div>
        <div className="muted" style={{ fontSize: 13 }}>
          {f.kg(ev.details.dryMass_kg)} dry · {f.kg(ev.details.wetMass_kg)} at launch
        </div>
      </div>

      <div className="legend">
        <Item n={n.hga} name={`High-gain antenna · ${f.num(design.comms.dishDiameter_m, 1)} m`} kg={m.comms} />
        <Item n={n.power} name={solar ? `Solar wings · ${f.num(design.power.arrayArea_m2 ?? 0, 1)} m²` : `MMRTG × ${design.power.rtgCount ?? 0}`} kg={m.powerGeneration} />
        <Item n={n.battery} name="Battery" kg={m.battery} />
        <Item n={n.tanks} name={`Tanks for ${f.kg(design.propellant_kg)} propellant`} kg={m.tanks} />
        <Item n={n.engine} name={engine?.name ?? design.engineId} />
        {m.instruments.map((ins, i) => (
          <Item key={ins.id} n={n.firstInst + i} name={PARTS.instruments[ins.id]?.name ?? ins.id} kg={ins.kg} />
        ))}
        <Item name={bus?.name ?? 'Bus'} kg={m.bus} />
        <Item name={`Growth margin +${f.pct(GAME_RULES.massGrowthMargin.value, 0)}`} kg={m.growthMargin} />
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }} className="faint">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, borderTop: '1.5px solid var(--bp)' }} />
            installed
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, borderTop: '1.5px dashed var(--bp)' }} />
            open slot
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, borderTop: '1.5px dashed var(--acc)' }} />
            drop target
          </span>
        </span>
      </div>
    </main>
  );
}

function Slot({ kind, glow, onDrop, children }: { kind: SlotKind; glow: boolean; onDrop: (p: PartPayload) => void; children: ReactNode }) {
  const [hover, setHover] = useState(false);
  const accept = (e: DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-mdt-part')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  return (
    <g
      className={`slot${glow ? ' glow' : ''}${hover && glow ? ' hover' : ''}`}
      onDragOver={accept}
      onDragEnter={(e) => {
        accept(e);
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const p = getDragPayload(e);
        if (p && p.kind === kind) onDrop(p);
      }}
    >
      {children}
    </g>
  );
}

function Callout({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g>
      <circle cx={x} cy={y - 4} r="9" style={{ fill: 'var(--bg)', stroke: 'var(--bp)' }} strokeWidth="1" />
      <text x={x} y={y}>
        {n}
      </text>
    </g>
  );
}

function Item({ n, name, kg }: { n?: number; name: string; kg?: number }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center' }}>
      {n !== undefined && <b>{n}</b>}
      {name}
      {kg !== undefined && <span className="v">{f.kg(kg)}</span>}
    </span>
  );
}
