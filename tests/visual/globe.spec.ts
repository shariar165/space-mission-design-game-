// The Mars globe on a slow phone (spec: UI rule 41): with the CPU throttled 4× the 3D globe must either keep at
// least GLOBE_MIN_FPS frames a second, or step down cleanly to the flat globe. Run: npm run shots -- globe
import { expect, test } from '@playwright/test';
import { GLOBE_MIN_FPS } from '../../src/ui/globeRules';
import { launchFlight, toMarsOrbit } from './helpers';

test('3D globe on a throttled phone: fast enough, or the flat globe', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'the throttled-phone check runs on the mobile project');
  await launchFlight(page, true);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await toMarsOrbit(page);
  // The watchdog judges two seconds after the first (spec: two slow seconds in a row fall back).
  await page.waitForTimeout(5000);
  const host = page.locator('.sci-globe-host');
  await expect(host).toBeVisible();
  const mode = (await host.getAttribute('class'))?.includes(' 3d') ? '3d' : '2d';
  const fps = Number(await page.evaluate(() => (document.querySelector('[data-globe="3d"]') as HTMLElement | null)?.dataset.fps ?? 'NaN'));
  console.log(`throttled phone: ${mode === '3d' ? `3D at ${fps} fps` : 'fell back to the flat globe'}`);
  if (mode === '3d') expect(fps).toBeGreaterThanOrEqual(GLOBE_MIN_FPS);
  else await expect(page.locator('.sci-globe-disc')).toBeVisible();
  await page.screenshot({ path: `test-results/shots/globe-throttled-${info.project.name}.png` });
});
