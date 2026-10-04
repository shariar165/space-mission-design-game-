// Build Bay (mockup: Build Bay.dc.html). Everything on screen is evaluateDesign(design) or a Sourced value.
import { useState } from 'react';
import type { FullEvaluation } from '../../engine/index';
import type { Design } from '../../engine/types';
import { BlockerBar } from '../components/BlockerBar';
import { BudgetPanel } from '../components/BudgetPanel';
import { CraftDrawing } from '../components/CraftDrawing';
import { PartsCatalog } from '../components/PartsCatalog';
import { applyPart, type SlotKind } from '../designOps';
import { useOpsRisk } from '../riskRunner';

interface Props {
  design: Design;
  ev: FullEvaluation;
  engineer: boolean;
  onChange: (d: Design) => void;
  onLaunch: () => void;
}

export function BuildBay({ design, ev, engineer, onChange, onLaunch }: Props) {
  const [dragKind, setDragKind] = useState<SlotKind | undefined>();
  const blocked = ev.blockers.length > 0;
  const risk = useOpsRisk(design);
  return (
    <div className="bay">
      <PartsCatalog design={design} ev={ev} engineer={engineer} onChange={onChange} onDragKind={setDragKind} />
      <CraftDrawing design={design} ev={ev} dragKind={dragKind} onDrop={(p) => onChange(applyPart(design, p))} />
      <aside className="budget" aria-label="Mission budget">
        <BudgetPanel ev={ev} design={design} engineer={engineer} risk={risk} />
        <BlockerBar ev={ev} engineer={engineer} risk={risk} />
        <button className="cta" disabled={blocked} onClick={onLaunch}>
          <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 1c2 2 3 5 3 8v4H5V9c0-3 1-6 3-8z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          Launch
        </button>
        <div className="cta-sub">{blocked ? 'Locked until every blocker is fixed' : 'Launch window and flight are simulated by the engine'}</div>
      </aside>
    </div>
  );
}
