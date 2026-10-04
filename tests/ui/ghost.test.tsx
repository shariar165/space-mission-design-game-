// @vitest-environment jsdom
// Flight map ghost: the real NASA mission's path beside the player's craft, only where a sourced preset exists.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildCadetDesign, defaultChoices } from '../../src/engine/cadet';
import { ghostFor } from '../../src/engine/flightMap';
import { evaluateDesign, simulateMission } from '../../src/engine/index';
import type { DestinationId } from '../../src/engine/types';
import * as f from '../../src/ui/format';
import { Flight } from '../../src/ui/screens/Flight';
import { starterDesign, today } from '../../src/ui/starters';
import './setup';

function renderFlight(dest: DestinationId) {
  const base = starterDesign(dest, today());
  const design = buildCadetDesign(base, defaultChoices(base));
  const ev = evaluateDesign(design);
  const sim = simulateMission(design, { seed: 8 });
  render(<Flight design={design} ev={ev} sim={sim} missionName="Test" onDone={() => undefined} />);
  return { design, ev };
}

describe('Ghost of the real mission', () => {
  it('Mars: MAVEN’s path is labelled as turned to start beside you, with both flight times from the engine', () => {
    const { design, ev } = renderFlight('mars');
    const g = ghostFor(design, ev)!;
    expect(screen.getByText(/MAVEN \(2013–2025\): real path, turned to start beside you/)).toBeTruthy();
    const race = screen.getByLabelText('Race against the real mission');
    expect(race.textContent).toContain(f.days(ev.trajectory.flightDays));
    expect(race.textContent).toContain(f.days(g.flightDays));
    expect(document.querySelector('.fm-ghost polyline')).toBeTruthy();
  });

  it('Venus: no sourced real mission yet, so no ghost', () => {
    renderFlight('venus');
    expect(screen.queryByLabelText('Race against the real mission')).toBeNull();
    expect(document.querySelector('.fm-ghost')).toBeNull();
  });
});
