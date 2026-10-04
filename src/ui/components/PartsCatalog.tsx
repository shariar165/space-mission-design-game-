// Left panel of Build Bay: the parts catalogue. Card stats are the Sourced catalogue values (each with ⓘ);
// a card's effect line is designDelta() — the engine re-evaluates the design with that part swapped in.
import { useMemo, useState, type ReactNode } from 'react';
import { designDelta, METER_KEYS, type DesignDelta, type MeterKey } from '../../engine/compare';
import { AU_M } from '../../engine/constants';
import { DESTINATIONS, LAUNCH_VEHICLES, PARTS, RIDESHARES } from '../../engine/data';
import type { FullEvaluation } from '../../engine/index';
import { ETA_SYS } from '../../engine/power';
import { bestArrival } from '../../engine/trajectory';
import type { Design, Sourced } from '../../engine/types';
import * as ops from '../designOps';
import type { PartPayload } from '../designOps';
import * as f from '../format';
import { METER_TITLES } from '../meters';
import { Check, PartIcon, type PartKind } from './icons';
import { SourceInfo } from './SourceInfo';

type Tab = PartKind | 'mission';

/** Input step sizes for the steppers (design inputs, not data). */
const STEPS = { area_m2: 1, rtg: 1, propellant_kg: 50, dish_m: 0.5, tx_W: 10, periapsis_km: 50, apoapsis_km: 1000, sciPeri_km: 10, sciApo_km: 100, scienceDays: 30 };

const TABS: { id: Tab; label: string }[] = [
  { id: 'bus', label: 'Bus' },
  { id: 'power', label: 'Power' },
  { id: 'instruments', label: 'Instruments' },
  { id: 'comms', label: 'Comms' },
  { id: 'propulsion', label: 'Propulsion' },
  { id: 'launcher', label: 'Launcher' },
];

interface Props {
  design: Design;
  ev: FullEvaluation;
  engineer: boolean;
  onChange: (d: Design) => void;
  onDragKind: (kind: PartPayload['kind'] | undefined) => void;
}

export function PartsCatalog({ design, ev, engineer, onChange, onDragKind }: Props) {
  const [tab, setTab] = useState<Tab>('power');
  const tabs = engineer ? [...TABS, { id: 'mission' as const, label: 'Orbit & dates' }] : TABS;
  const active = !engineer && tab === 'mission' ? 'power' : tab;
  return (
    <aside className="catalog" aria-label="Parts catalogue">
      <div className="catalog-head">
        <h2 className="h2">Parts catalog</h2>
        <div className="muted" style={{ fontSize: 13 }}>
          Drag a part onto a glowing slot, or use Add / Swap.
        </div>
      </div>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={active === t.id} className="tab" onClick={() => setTab(t.id)}>
            {t.id === 'mission' ? <PartIcon kind="launcher" /> : <PartIcon kind={t.id} />}
            {t.label}
          </button>
        ))}
      </div>
      <TabTip tab={active} design={design} ev={ev} engineer={engineer} />
      <div className="parts" role="tabpanel">
        {active === 'bus' && <BusTab {...{ design, ev, onChange, onDragKind }} />}
        {active === 'power' && <PowerTab {...{ design, ev, onChange, onDragKind }} />}
        {active === 'instruments' && <InstrumentsTab {...{ design, ev, onChange, onDragKind }} />}
        {active === 'comms' && <CommsTab {...{ design, ev, onChange, engineer }} />}
        {active === 'propulsion' && <PropulsionTab {...{ design, ev, onChange, onDragKind }} />}
        {active === 'launcher' && <LauncherTab {...{ design, ev, onChange, onDragKind }} />}
        {active === 'mission' && <MissionTab {...{ design, ev, onChange }} />}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------

function TabTip({ tab, design, ev, engineer }: { tab: Tab; design: Design; ev: FullEvaluation; engineer: boolean }) {
  const dest = DESTINATIONS[design.destination];
  const rSun = ev.meters.power.inputs.sunDistance?.value;
  const tips: Record<Tab, { say: string; eq?: string }> = {
    bus: { say: 'The bus is the body of the craft: structure, computer, wiring and heaters. Bigger buses carry more, but weigh and cost more.' },
    power: {
      say:
        design.power.type === 'rtg'
          ? `RTGs turn the heat of decaying plutonium into electricity, so they work just as well far from the Sun.`
          : `${dest.name} gets ${f.pct(dest.sunlightVsEarth.value, 1)} of the sunlight Earth gets. Bring bigger panels, or a nuclear RTG.`,
      eq: rSun !== undefined ? `P = S₀ · (1 AU / r)² · A · η_sys   ·   r = ${f.num(rSun / AU_M, 3)} AU` : undefined,
    },
    instruments: { say: 'Instruments are why the mission flies. Each one makes data every day, and the science goal is everything they make during the planned science phase.' },
    comms: {
      say: `Data rate falls with the square of distance. On arrival day ${dest.name} is ${f.millionKm(ev.details.earthDistanceAtArrival_m)} away, and signals take ${f.minutes(ev.details.lightDelayAtArrival_s)} each way.`,
      eq: 'R ∝ P_t · D_sc² · D_gs² / d²',
    },
    propulsion: {
      say: 'Every burn costs propellant, and every kilogram of propellant must itself be carried. That is the rocket equation.',
      eq: 'Δv = Isp · g₀ · ln(m_wet / m_dry)',
    },
    launcher: {
      say: `The more launch energy (C3) a trip needs, the less a rocket can lift. This trip needs C3 = ${f.c3(ev.trajectory.c3)}.`,
      eq: 'm_max(C3): read off the vehicle performance curve',
    },
    mission: {
      say: `Lambert transfer: ${f.days(ev.trajectory.flightDays)} of flight, arriving at ${f.num(ev.trajectory.vInfArr, 2)} km/s.`,
    },
  };
  const t = tips[tab];
  return (
    <div className="cadet-tip">
      <span>{t.say}</span>
      {engineer && t.eq && <span className="eq">{t.eq}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Building blocks

function Stat({ s, text, title }: { s: Sourced<unknown>; text: string; title: string }) {
  return (
    <span className="stat">
      {text}
      <SourceInfo s={s} title={title} />
    </span>
  );
}

function Effect({ d, show = [] }: { d: DesignDelta; show?: MeterKey[] }) {
  const notOk = METER_KEYS.filter((k) => d.meters[k].statusBefore !== 'ok');
  return (
    <div className="effect">
      {f.signedKg(d.wetMass_kg)} launch mass · {f.signedMoney(d.developmentCost_M)}
      {show.map((k) => (
        <span key={k}>
          {' '}
          · {METER_TITLES[k]} margin {f.signedPct(d.meters[k].marginBefore, 0)} → {f.signedPct(d.meters[k].marginAfter, 0)}
        </span>
      ))}
      {d.fixes.length > 0 && <span className="good"> · fixes {d.fixes.map((k) => METER_TITLES[k]).join(', ')}</span>}
      {d.breaks.length > 0 && <span className="bad"> · breaks {d.breaks.map((k) => METER_TITLES[k]).join(', ')}</span>}
      {d.fixes.length === 0 && d.breaks.length === 0 && notOk.length > 0 && <span> · fixes nothing on {notOk.map((k) => METER_TITLES[k]).join(', ')}</span>}
    </div>
  );
}

function PartCard({
  kind,
  title,
  installed,
  payload,
  onDragKind,
  stats,
  children,
}: {
  kind: PartKind;
  title: string;
  installed: boolean;
  payload?: PartPayload;
  onDragKind?: (k: PartPayload['kind'] | undefined) => void;
  stats: ReactNode;
  children?: ReactNode;
}) {
  const [dragging, setDragging] = useState(false);
  const draggable = !!payload && !installed;
  return (
    <div
      className={`part${installed ? ' installed' : ''}${dragging ? ' dragging' : ''}`}
      draggable={draggable}
      onDragStart={(e) => {
        if (!payload) return;
        ops.setDragPayload(e, payload);
        setDragging(true);
        onDragKind?.(payload.kind);
      }}
      onDragEnd={() => {
        setDragging(false);
        onDragKind?.(undefined);
      }}
    >
      <div className="part-icon">
        <PartIcon kind={kind} size={26} />
      </div>
      <div className="part-body">
        <div className="part-title">
          <span>{title}</span>
          {installed && (
            <span className="chip ok plain" style={{ fontSize: 10 }}>
              <Check size={11} />
              INSTALLED
            </span>
          )}
        </div>
        <div className="stats">{stats}</div>
        {children}
      </div>
    </div>
  );
}

function Stepper({ value, step, unit, onChange, digits = 0 }: { value: number; step: number; unit: string; onChange: (x: number) => void; digits?: number }) {
  const [text, setText] = useState<string | undefined>(undefined);
  return (
    <span className="stepper">
      <button type="button" aria-label={`Decrease by ${step} ${unit}`} onClick={() => onChange(value - step)}>
        −
      </button>
      <input
        aria-label={unit}
        value={text ?? `${f.num(value, digits)} ${unit}`}
        onFocus={() => setText(String(value))}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const x = Number.parseFloat((text ?? '').replace(/,/g, ''));
          if (Number.isFinite(x)) onChange(x);
          setText(undefined);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <button type="button" aria-label={`Increase by ${step} ${unit}`} onClick={() => onChange(value + step)}>
        +
      </button>
    </span>
  );
}

type TabProps = { design: Design; ev: FullEvaluation; onChange: (d: Design) => void; onDragKind: Props['onDragKind'] };

const useDelta = (design: Design, ev: FullEvaluation, candidate: Design | undefined) =>
  useMemo(() => (candidate ? designDelta(design, candidate, ev) : undefined), [design, ev, candidate]);

function DeltaFor({ design, ev, candidate, show }: { design: Design; ev: FullEvaluation; candidate: Design; show?: MeterKey[] }) {
  const d = useDelta(design, ev, candidate);
  return d ? <Effect d={d} show={show ?? []} /> : null;
}

// ---------------------------------------------------------------------------
// Tabs

function BusTab({ design, ev, onChange, onDragKind }: TabProps) {
  return (
    <>
      {Object.entries(PARTS.buses).map(([id, b]) => {
        const installed = design.busId === id;
        const candidate = ops.withBus(design, id);
        return (
          <PartCard
            key={id}
            kind="bus"
            title={b.name}
            installed={installed}
            payload={{ kind: 'bus', id }}
            onDragKind={onDragKind}
            stats={
              <>
                <Stat s={b.mass_kg} text={f.kg(b.mass_kg.value)} title={`${b.name} mass`} />
                <Stat s={b.power_W} text={f.watts(b.power_W.value)} title={`${b.name} power draw`} />
                <Stat s={b.cost_M} text={f.money(b.cost_M.value)} title={`${b.name} cost`} />
              </>
            }
          >
            {!installed && (
              <>
                <DeltaFor design={design} ev={ev} candidate={candidate} />
                <div className="part-actions">
                  <button className="btn-sm" onClick={() => onChange(candidate)}>
                    Swap in
                  </button>
                </div>
              </>
            )}
          </PartCard>
        );
      })}
    </>
  );
}

function PowerTab({ design, ev, onChange, onDragKind }: TabProps) {
  const p = PARTS.power;
  const solar = design.power.type === 'solar';
  const area = design.power.arrayArea_m2 ?? 0;
  const rtgs = design.power.rtgCount ?? 0;
  const m = ev.details.massBreakdown;
  return (
    <>
      <PartCard
        kind="power"
        title={solar ? `Solar array · ${f.num(area, area % 1 ? 1 : 0)} m²` : 'Solar array'}
        installed={solar}
        payload={{ kind: 'power', id: 'solar' }}
        onDragKind={onDragKind}
        stats={
          <>
            <Stat s={p.solarArraySpecificMass_kg_per_m2} text={`${f.num(p.solarArraySpecificMass_kg_per_m2.value)} kg/m²`} title="Array specific mass" />
            <Stat s={p.solarArrayCost_M_per_m2} text={`${f.money(p.solarArrayCost_M_per_m2.value, 1)}/m²`} title="Array cost per m²" />
            <Stat s={ETA_SYS} text={`η ${f.num(ETA_SYS.value, 2)}`} title="System efficiency" />
          </>
        }
      >
        {solar ? (
          <>
            <div className="effect">
              Makes {f.watts(ev.details.power.available_W)} on arrival · {f.kg(m.powerGeneration)} · {f.money(ev.details.costBreakdown.power, 1)}
            </div>
            <div className="part-actions">
              <Stepper value={area} step={STEPS.area_m2} unit="m²" digits={area % 1 ? 1 : 0} onChange={(x) => onChange(ops.withArrayArea(design, x))} />
            </div>
            <span className="faint" style={{ fontSize: 11.5 }}>
              Next +{STEPS.area_m2} m²:
            </span>
            <DeltaFor design={design} ev={ev} candidate={ops.withArrayArea(design, area + STEPS.area_m2)} show={['power']} />
          </>
        ) : (
          <>
            <DeltaFor design={design} ev={ev} candidate={ops.withPowerType(design, 'solar')} show={['power']} />
            <div className="part-actions">
              <button className="btn-sm" onClick={() => onChange(ops.withPowerType(design, 'solar'))}>
                Switch to solar
              </button>
            </div>
          </>
        )}
      </PartCard>

      <PartCard
        kind="power"
        title={!solar ? `MMRTG (nuclear) × ${rtgs}` : 'MMRTG (nuclear)'}
        installed={!solar}
        payload={{ kind: 'power', id: 'rtg' }}
        onDragKind={onDragKind}
        stats={
          <>
            <Stat s={p.rtgMass_kg} text={f.kg(p.rtgMass_kg.value)} title="MMRTG mass" />
            <Stat s={p.rtgPower_W} text={`${f.watts(p.rtgPower_W.value)} any r`} title="MMRTG power" />
            <Stat s={p.rtgCost_M} text={f.money(p.rtgCost_M.value)} title="MMRTG cost" />
          </>
        }
      >
        {!solar ? (
          <>
            <div className="effect">
              Makes {f.watts(ev.details.power.available_W)} anywhere · {f.kg(m.powerGeneration)} · {f.money(ev.details.costBreakdown.power)}
            </div>
            <div className="part-actions">
              <Stepper value={rtgs} step={STEPS.rtg} unit="RTG" onChange={(x) => onChange(ops.withRtgCount(design, x))} />
            </div>
          </>
        ) : (
          <>
            <DeltaFor design={design} ev={ev} candidate={ops.withPowerType(design, 'rtg')} show={['power']} />
            <div className="part-actions">
              <button className="btn-sm" onClick={() => onChange(ops.withPowerType(design, 'rtg'))}>
                Switch to RTG
              </button>
            </div>
          </>
        )}
      </PartCard>

      <PartCard
        kind="power"
        title="Li-ion battery (auto-sized)"
        installed
        stats={<Stat s={p.batterySpecificEnergy_Wh_per_kg} text={`${f.num(p.batterySpecificEnergy_Wh_per_kg.value)} Wh/kg`} title="Battery specific energy" />}
      >
        <div className="effect">
          {f.kg(m.battery)}: sized to carry the full load through the longest eclipse in the science orbit.
        </div>
      </PartCard>
    </>
  );
}

function InstrumentsTab({ design, ev, onChange, onDragKind }: TabProps) {
  return (
    <>
      {Object.entries(PARTS.instruments).map(([id, ins]) => {
        const installed = design.instrumentIds.includes(id);
        const candidate = installed ? ops.removeInstrument(design, id) : ops.addInstrument(design, id);
        return (
          <PartCard
            key={id}
            kind="instruments"
            title={ins.name}
            installed={installed}
            payload={{ kind: 'instrument', id }}
            onDragKind={onDragKind}
            stats={
              <>
                <Stat s={ins.mass_kg} text={f.kg(ins.mass_kg.value)} title={`${ins.name} mass`} />
                <Stat s={ins.power_W} text={f.watts(ins.power_W.value)} title={`${ins.name} power`} />
                <Stat s={ins.data_Mbit_per_day} text={`${f.num(ins.data_Mbit_per_day.value)} Mbit/day`} title={`${ins.name} data`} />
                <Stat s={ins.cost_M} text={f.money(ins.cost_M.value)} title={`${ins.name} cost`} />
              </>
            }
          >
            <DeltaFor design={design} ev={ev} candidate={candidate} show={['data']} />
            <div className="part-actions">
              <button className="btn-sm" onClick={() => onChange(candidate)}>
                {installed ? 'Remove' : 'Add'}
              </button>
            </div>
          </PartCard>
        );
      })}
    </>
  );
}

function CommsTab({ design, ev, onChange, engineer }: Omit<TabProps, 'onDragKind'> & { engineer: boolean }) {
  const c = PARTS.comms;
  const dish = design.comms.dishDiameter_m;
  const other: 34 | 70 = design.comms.groundDish_m === 34 ? 70 : 34;
  return (
    <>
      <PartCard
        kind="comms"
        title={`High-gain antenna · ${f.num(dish, 1)} m`}
        installed
        stats={
          <>
            <Stat s={c.dishArealMass_kg_per_m2} text={`${f.num(c.dishArealMass_kg_per_m2.value)} kg/m²`} title="Dish areal mass" />
            <Stat s={c.dishCost_M_per_m2} text={`${f.money(c.dishCost_M_per_m2.value)}/m²`} title="Dish cost per m²" />
            <Stat s={c.dcToRfEfficiency} text={`DC→RF ${f.pct(c.dcToRfEfficiency.value, 0)}`} title="Transmitter efficiency" />
          </>
        }
      >
        <div className="effect">
          Sends {f.bits(ev.details.data.downlinkedPerDayAtArrival_bits)}/day on arrival · radio {f.kg(ev.details.massBreakdown.comms)} ·{' '}
          {f.money(ev.details.costBreakdown.comms, 1)}
        </div>
        <div className="part-actions">
          <Stepper value={dish} step={STEPS.dish_m} unit="m dish" digits={1} onChange={(x) => onChange(ops.withDish(design, x))} />
        </div>
        <DeltaFor design={design} ev={ev} candidate={ops.withDish(design, dish + STEPS.dish_m)} show={['data']} />
        {engineer && (
          <div className="field">
            Transmitter power
            <Stepper value={design.comms.txPower_W} step={STEPS.tx_W} unit="W" onChange={(x) => onChange(ops.withTxPower(design, x))} />
          </div>
        )}
      </PartCard>
      <PartCard kind="comms" title={`Deep Space Network · ${design.comms.groundDish_m} m dish`} installed stats={<span className="faint">Ground station on Earth</span>}>
        <DeltaFor design={design} ev={ev} candidate={ops.withGroundDish(design, other)} show={['data']} />
        <div className="part-actions">
          <button className="btn-sm" onClick={() => onChange(ops.withGroundDish(design, other))}>
            Use the {other} m dish
          </button>
        </div>
      </PartCard>
    </>
  );
}

function PropulsionTab({ design, ev, onChange, onDragKind }: TabProps) {
  const prop = design.propellant_kg;
  return (
    <>
      <PartCard
        kind="propulsion"
        title={`Propellant · ${f.kg(prop)}`}
        installed
        stats={
          <>
            <span className="stat">tanks {f.kg(ev.details.massBreakdown.tanks)}</span>
            <span className="stat">Δv {f.speed(ev.details.deltaVCapability_ms)}</span>
          </>
        }
      >
        <div className="part-actions">
          <Stepper value={prop} step={STEPS.propellant_kg} unit="kg" onChange={(x) => onChange(ops.withPropellant(design, x))} />
        </div>
        <span className="faint" style={{ fontSize: 11.5 }}>
          Next +{STEPS.propellant_kg} kg:
        </span>
        <DeltaFor design={design} ev={ev} candidate={ops.withPropellant(design, prop + STEPS.propellant_kg)} show={['deltaV', 'mass']} />
      </PartCard>
      {Object.entries(PARTS.engines).map(([id, e]) => {
        const installed = design.engineId === id;
        const candidate = ops.withEngine(design, id);
        return (
          <PartCard
            key={id}
            kind="propulsion"
            title={e.name}
            installed={installed}
            payload={{ kind: 'engine', id }}
            onDragKind={onDragKind}
            stats={
              <>
                <Stat s={e.isp_s} text={`Isp ${f.num(e.isp_s.value)} s`} title={`${e.name} Isp`} />
                {e.power_W.value > 0 && <Stat s={e.power_W} text={f.watts(e.power_W.value)} title={`${e.name} power`} />}
                <Stat s={e.cost_M} text={f.money(e.cost_M.value)} title={`${e.name} cost`} />
              </>
            }
          >
            {!e.canCapture && <div className="effect">Cruise and rendezvous only: it cannot do a fast capture burn.</div>}
            {!installed && (
              <>
                <DeltaFor design={design} ev={ev} candidate={candidate} show={['deltaV']} />
                <div className="part-actions">
                  <button className="btn-sm" onClick={() => onChange(candidate)}>
                    Swap in
                  </button>
                </div>
              </>
            )}
          </PartCard>
        );
      })}
    </>
  );
}

function LauncherTab({ design, ev, onChange, onDragKind }: TabProps) {
  return (
    <>
      {Object.entries(LAUNCH_VEHICLES).map(([id, lv]) => {
        const installed = design.launchVehicleId === id && !design.rideshareId;
        const candidate = ops.withLauncher(design, id);
        return (
          <PartCard
            key={id}
            kind="launcher"
            title={lv.name}
            installed={installed}
            payload={{ kind: 'launcher', id }}
            onDragKind={onDragKind}
            stats={
              <>
                <Stat s={lv.successes} text={`${f.num(lv.successes.value)} / ${f.num(lv.flights.value)} flights`} title={`${lv.name} record`} />
                <Stat s={lv.price_M} text={f.money(lv.price_M.value)} title={`${lv.name} price`} />
                <Stat s={lv.payloadCurve} text="payload vs C3" title={`${lv.name} performance curve`} />
              </>
            }
          >
            {installed ? (
              <div className="effect">
                Lifts {f.kg(ev.details.launchCapacity_kg)} at C3 {f.c3(ev.trajectory.c3)} · launch success {f.pct(ev.details.launchSuccess)}
              </div>
            ) : (
              <>
                <DeltaFor design={design} ev={ev} candidate={candidate} show={['mass']} />
                <div className="part-actions">
                  <button className="btn-sm" onClick={() => onChange(candidate)}>
                    Swap in
                  </button>
                </div>
              </>
            )}
          </PartCard>
        );
      })}
      {Object.entries(RIDESHARES)
        .filter(([, r]) => r.destination === design.destination)
        .map(([id, r]) => {
          const installed = design.rideshareId === id;
          const lv = LAUNCH_VEHICLES[r.vehicleId];
          const candidate = ops.withRideshare(design, id, r.vehicleId);
          return (
            <PartCard
              key={id}
              kind="launcher"
              title={r.name}
              installed={installed}
              stats={
                <>
                  <Stat s={r.secondarySlot_kg} text={`${f.kg(r.secondarySlot_kg.value)} secondary slot`} title="Secondary payload slot" />
                  <Stat s={r.primaryMass_kg} text={`beside ${f.kg(r.primaryMass_kg.value)} LRO`} title="Primary payload" />
                  {lv && <Stat s={lv.successes} text={`${lv.name}: ${f.num(lv.successes.value)} / ${f.num(lv.flights.value)} flights`} title={`${lv.name} record`} />}
                </>
              }
            >
              <div className="effect faint">
                Real precedent:{' '}
                <a href={r.precedentUrl} target="_blank" rel="noreferrer">
                  {r.precedent}
                </a>
                . You pay a share of the rocket in proportion to your mass.
              </div>
              {installed ? (
                <div className="effect">
                  Slot {f.kg(ev.details.launchCapacity_kg)} · your share of the rocket {f.money(ev.details.cost.launch_M, 1)} · launch success {f.pct(ev.details.launchSuccess)}
                </div>
              ) : (
                <>
                  <DeltaFor design={design} ev={ev} candidate={candidate} show={['mass']} />
                  <div className="part-actions">
                    <button className="btn-sm" onClick={() => onChange(candidate)}>
                      Share the ride
                    </button>
                  </div>
                </>
              )}
            </PartCard>
          );
        })}
    </>
  );
}

function MissionTab({ design, ev, onChange }: Omit<TabProps, 'onDragKind'>) {
  const co = design.captureOrbit;
  const so = design.scienceOrbit;
  const t = ev.trajectory;
  const fixedRoute = t.method === 'fixed-route';
  const setLaunch = (launchDate: string) => {
    if (design.destination === 'moon') return onChange(ops.withDates(design, launchDate, launchDate));
    try {
      onChange(ops.withDates(design, launchDate, bestArrival(design.destination, launchDate).arrivalDate));
    } catch {
      onChange(ops.withDates(design, launchDate, design.arrivalDate));
    }
  };
  return (
    <>
      <PartCard kind="launcher" title="Launch and arrival" installed stats={<span className="faint">{t.method === 'lambert' ? 'Lambert transfer' : fixedRoute ? 'NASA real route' : 'Hohmann transfer'}</span>}>
        <div className="field">
          Launch
          <input type="date" value={ev.details.launchDate} disabled={fixedRoute} onChange={(e) => e.target.value && setLaunch(e.target.value)} />
        </div>
        {design.destination !== 'moon' && (
          <div className="field">
            Arrival
            <input
              type="date"
              value={ev.details.arrivalDate}
              disabled={fixedRoute}
              onChange={(e) => e.target.value && onChange(ops.withDates(design, design.launchDate, e.target.value))}
            />
          </div>
        )}
        <div className="effect">
          C3 {f.c3(t.c3)} · v∞ {f.num(t.vInfArr, 2)} km/s · {f.days(t.flightDays)}
          {t.maxFlightDays !== undefined && <> · limit {f.days(Math.floor(t.maxFlightDays))}</>}
        </div>
      </PartCard>
      <PartCard kind="propulsion" title="Capture orbit (altitudes)" installed stats={<span className="stat">arrival burn {f.speed(ev.details.deltaVBudget.arrival_ms)}</span>}>
        <div className="field">
          Periapsis
          <Stepper value={co.periapsis_km} step={STEPS.periapsis_km} unit="km" onChange={(x) => onChange(ops.withCaptureOrbit(design, x, co.apoapsis_km))} />
        </div>
        <div className="field">
          Apoapsis
          <Stepper value={co.apoapsis_km} step={STEPS.apoapsis_km} unit="km" onChange={(x) => onChange(ops.withCaptureOrbit(design, co.periapsis_km, x))} />
        </div>
      </PartCard>
      {so && (
        <PartCard kind="propulsion" title="Science orbit (altitudes)" installed stats={<span className="stat">orbit change {f.speed(ev.details.deltaVBudget.orbitTransfer_ms)}</span>}>
          <div className="field">
            Periapsis
            <Stepper value={so.periapsis_km} step={STEPS.sciPeri_km} unit="km" onChange={(x) => onChange(ops.withScienceOrbit(design, x, so.apoapsis_km))} />
          </div>
          <div className="field">
            Apoapsis
            <Stepper value={so.apoapsis_km} step={STEPS.sciApo_km} unit="km" onChange={(x) => onChange(ops.withScienceOrbit(design, so.periapsis_km, x))} />
          </div>
        </PartCard>
      )}
      <PartCard kind="instruments" title="Science phase" installed stats={<span className="stat">maintenance {f.speed(ev.details.deltaVBudget.maintenance_ms)}</span>}>
        <div className="field">
          Science days
          <Stepper value={ev.details.scienceDays} step={STEPS.scienceDays} unit="days" onChange={(x) => onChange(ops.withScienceDays(design, x))} />
        </div>
        <div className="field">
          Cost cap class
          <span className="seg">
            {(['discovery', 'newFrontiers'] as const).map((c) => (
              <button key={c} aria-pressed={(design.missionClass ?? 'discovery') === c} onClick={() => onChange(ops.withMissionClass(design, c))}>
                {c === 'discovery' ? 'Discovery' : 'New Frontiers'}
              </button>
            ))}
          </span>
        </div>
      </PartCard>
    </>
  );
}
