// Standing orders: for each crisis this mission can meet, the player picks what the craft does on its
// own. Options and their costs come from crisisOrders(); an option the spare margins cannot pay for is
// shown but locked. With no order set, the craft takes the safest option.
import type { CrisisOrder } from '../../engine/index';
import { COST_ICON } from '../cadetWords';
import * as f from '../format';
import { SourceInfo } from './SourceInfo';
import { Check } from './icons';

export function OrdersPanel({ orders, chosen, onChoose }: { orders: CrisisOrder[]; chosen: Record<string, string>; onChoose: (cardId: string, optionId: string) => void }) {
  return (
    <div className="orders">
      {orders.map((o) => {
        const current = chosen[o.card.id] ?? o.defaultOptionId;
        return (
          <section key={o.card.id} className="order" aria-label={`If: ${o.card.title}`}>
            <div className="order-head">
              <span className="order-if">If</span>
              <span className="order-title">{o.card.title}</span>
              <SourceInfo s={o.card.realHistory} title={`${o.card.title}: real history`} />
            </div>
            <div className="order-opts" role="group" aria-label={`${o.card.title} orders`}>
              {o.card.options.map((opt) => {
                const can = o.available.some((a) => a.id === opt.id);
                const on = current === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`order-opt${on ? ' on' : ''}`}
                    aria-pressed={on}
                    disabled={!can}
                    onClick={() => onChoose(o.card.id, opt.id)}
                  >
                    <span className="order-label">
                      {on && <Check size={13} />} {opt.label}
                    </span>
                    <span className="order-costs">
                      {opt.cost.deltaV_ms && (
                        <span className="cchip sm">
                          {COST_ICON.fuel} {f.kg(o.fuel_kg[opt.id] ?? 0)}
                        </span>
                      )}
                      {opt.cost.budget_M && (
                        <span className="cchip sm">
                          {COST_ICON.budget} {f.money(opt.cost.budget_M.value)}
                        </span>
                      )}
                      {opt.cost.scienceDays && (
                        <span className="cchip sm">
                          {COST_ICON.science} −{f.days(opt.cost.scienceDays.value)}
                        </span>
                      )}
                      {!opt.cost.deltaV_ms && !opt.cost.budget_M && !opt.cost.scienceDays && <span className="cchip sm">free</span>}
                      {opt.id === o.defaultOptionId && <span className="safer">safer</span>}
                      {!can && <span className="cchip sm red">can’t afford</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
