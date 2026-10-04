// The three big actions under the map (mockup dock): Power plan, Book a call home, Command queue.
import type { ReactNode } from 'react';
import type { OpsConsoleView } from '../../../engine/ops/console';
import * as f from '../../format';
import { CallIcon, PowerPlanIcon, QueueIcon } from './opsIcons';

export type OpsPanel = 'power' | 'call' | 'queue';

interface Props {
  view: OpsConsoleView;
  engineer: boolean;
  open?: OpsPanel;
  onOpen: (p: OpsPanel) => void;
}

export function ActionDock({ view, engineer, open, onOpen }: Props) {
  const flying = view.commands.filter((c) => c.status === 'in-flight').length;
  const blackout = view.blackout.active;
  const slot = view.timeline.events.find((e) => e.kind === 'open-slot');
  const items: { id: OpsPanel; icon: ReactNode; t: string; s: string; e: string; badge?: number }[] = [
    {
      id: 'power',
      icon: <PowerPlanIcon />,
      t: 'Power plan',
      s: blackout ? 'Locked until contact returns' : 'Science · Heaters · Radio',
      e: `${f.watts(view.gauges.power.used)} of ${f.watts(view.gauges.power.limit)}`,
    },
    {
      id: 'call',
      icon: <CallIcon />,
      t: 'Book a call home',
      s: slot ? `Next free day: ${f.num(slot.day)}` : 'Big or small dish',
      e: `booked a week ahead`,
    },
    {
      id: 'queue',
      icon: <QueueIcon />,
      t: 'Command queue',
      s: flying ? `${f.num(flying)} on its way` : 'Nothing on its way',
      e: `one way ${f.lightTime(view.clock.oneWay_s)}`,
      ...(flying ? { badge: flying } : {}),
    },
  ];
  return (
    <div className="ops-dock">
      {items.map((k) => (
        <button key={k.id} type="button" className={`ops-dock-btn${open === k.id ? ' active' : ''}`} aria-pressed={open === k.id} onClick={() => onOpen(k.id)}>
          <span className="ops-icon-box acc">{k.icon}</span>
          <span className="ops-dock-text">
            <span className="h3">{k.t}</span>
            <span className="muted">{k.s}</span>
            {engineer && <span className="mono bp">{k.e}</span>}
          </span>
          {k.badge !== undefined && <span className="ops-badge">{f.num(k.badge)}</span>}
        </button>
      ))}
    </div>
  );
}
