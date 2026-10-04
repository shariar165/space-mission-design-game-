// @vitest-environment jsdom
// The Risk meter in Engineer mode: the Mission operations Monte Carlo, filled in as it runs (inline here,
// a Web Worker in the browser). Expected values come from the engine, never typed in.
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { evaluateDesign } from '../../src/engine/index';
import { opsRiskEstimate, RISK_SEED } from '../../src/engine/ops/riskEstimate';
import * as f from '../../src/ui/format';
import { BuildBay } from '../../src/ui/screens/BuildBay';
import { starterDesign } from '../../src/ui/starters';
import { TEST_RISK_RUNS } from './setup';

describe('Risk meter (Ops Monte Carlo)', () => {
  const design = starterDesign('mars', '2026-10-04');
  const ev = evaluateDesign(design);

  it('shows a computing state, then the engine estimate with its run count and seed', async () => {
    render(<BuildBay design={design} ev={ev} engineer={false} onChange={() => {}} onLaunch={() => {}} />);
    const card = screen.getByRole('region', { name: 'Risk meter' });
    expect(within(card).getByText('Simulating')).toBeTruthy();
    const expected = opsRiskEstimate(design, { runs: TEST_RISK_RUNS });
    await waitFor(() => expect(screen.getByText(`${f.num(TEST_RISK_RUNS)} simulated missions · seed ${RISK_SEED.value} · Mission operations model`)).toBeTruthy(), {
      timeout: 30_000,
    });
    const done = screen.getByRole('region', { name: 'Risk meter' });
    expect(done.textContent).toContain(f.pct(expected.meter.used));
    expect(done.textContent).toContain(`of ${f.num(TEST_RISK_RUNS)} simulated missions`);
  }, 60_000);
});
