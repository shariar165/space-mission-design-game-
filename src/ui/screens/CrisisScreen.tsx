// The one crisis card of this flight (until the Flight screen exists). previewCrisis() draws the same card
// simulateMission() will meet for this seed, and offers only the options the spare margins can pay for.
import type { CrisisOption } from '../../engine/crisis';
import { DESTINATIONS } from '../../engine/data';
import type { FullEvaluation } from '../../engine/index';
import type { previewCrisis } from '../../engine/index';
import type { Design } from '../../engine/types';
import { SourceInfo } from '../components/SourceInfo';
import { StatusIcon } from '../components/icons';
import * as f from '../format';

type Preview = NonNullable<ReturnType<typeof previewCrisis>>;

const PHASE: Record<string, string> = { launch: 'launch', cruise: 'cruise', arrival: 'arrival', science: 'science operations', return: 'the trip home' };

export function CrisisScreen({
  preview,
  ev,
  design,
  seed,
  onChoose,
}: {
  preview: Preview;
  ev: FullEvaluation;
  design: Design;
  seed: number;
  onChoose: (id: string) => void;
}) {
  const { card, day, phase, options } = preview;
  const offered = new Set(options.map((o) => o.id));
  const dest = DESTINATIONS[design.destination];
  return (
    <div className="crisis-wrap">
      <article className="crisis" aria-labelledby="crisis-title">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="chip warning">
            <StatusIcon status="warning" />
            CRISIS
          </span>
          <span className="mono faint" style={{ fontSize: 12 }}>
            MISSION DAY {f.num(day)} · {PHASE[phase]?.toUpperCase()}
            {card.decisionBeforeLaunch ? ' · DECIDE BEFORE LAUNCH' : ''}
          </span>
          <span className="mono faint" style={{ fontSize: 12, marginLeft: 'auto' }}>
            FLIGHT SEED {seed}
          </span>
        </div>
        <h1 id="crisis-title">{card.title}</h1>
        <p style={{ margin: 0, font: '17px/1.55 var(--body)' }}>{card.prompt}</p>
        <div className="history">
          <SourceInfo s={card.realHistory} title="Real history" />
          <div>
            <div className="kicker" style={{ marginBottom: 6 }}>
              Real history
            </div>
            {card.realHistory.value}
          </div>
        </div>
        <div className="muted" style={{ fontSize: 13.5 }}>
          On arrival day, radio signals between Earth and {dest.name} take {f.minutes(ev.details.lightDelayAtArrival_s)} each way, so the team cannot steer in real time. It decides with the margins the craft already has: {f.speed(ev.meters.deltaV.headroom)} of spare Δv and{' '}
          {f.money(ev.meters.cost.headroom)} of budget under the cap.
        </div>
        <div className="options" role="list">
          {card.options.map((o) => (
            <OptionButton key={o.id} o={o} available={offered.has(o.id)} onChoose={onChoose} />
          ))}
        </div>
      </article>
    </div>
  );
}

function OptionButton({ o, available, onChoose }: { o: CrisisOption; available: boolean; onChoose: (id: string) => void }) {
  const costs = [
    o.cost.deltaV_ms && { s: o.cost.deltaV_ms, text: `${f.speed(o.cost.deltaV_ms.value)} of Δv`, title: 'Δv cost' },
    o.cost.budget_M && { s: o.cost.budget_M, text: `${f.money(o.cost.budget_M.value)} of budget`, title: 'Budget cost' },
    o.cost.scienceDays && { s: o.cost.scienceDays, text: `${f.days(o.cost.scienceDays.value)} of science`, title: 'Science days lost' },
    o.requires?.powerMargin && { s: o.requires.powerMargin, text: `needs ${f.pct(o.requires.powerMargin.value, 0)} power margin`, title: 'Power margin needed' },
  ].filter((x): x is { s: NonNullable<CrisisOption['cost']['deltaV_ms']>; text: string; title: string } => !!x);
  return (
    <div role="listitem" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button className="option" disabled={!available} onClick={() => onChoose(o.id)}>
        <span className="option-label">{o.label}</span>
        <span className="mono muted" style={{ fontSize: 12.5 }}>
          {costs.length ? costs.map((c) => c.text).join(' · ') : 'costs nothing now'} · {f.pct(o.failureChance.value, o.failureChance.value < 0.01 ? 1 : 0)} chance the{' '}
          {PHASE[o.affects] ?? o.affects} phase is lost
        </span>
        {!available && <span style={{ color: 'var(--bad)', fontSize: 13 }}>Your spare margins cannot pay for this option.</span>}
      </button>
      <span style={{ display: 'flex', gap: 10, alignItems: 'center', paddingLeft: 4 }} className="faint">
        {costs.map((c) => (
          <span key={c.title} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12 }}>
            {c.title}
            <SourceInfo s={c.s} title={c.title} />
          </span>
        ))}
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12 }}>
          Failure chance
          <SourceInfo s={o.failureChance} title="Failure chance" />
        </span>
      </span>
    </div>
  );
}
