// The hero Mars globe on a slow phone (spec: UI rule 41): with the CPU throttled 4× the 3D globe must either keep at
// least GLOBE_MIN_FPS frames a second, at rest and while the camera eases to a target, or step down cleanly to the
// flat globe. Run: npm run shots -- globe
import { expect, test, type Page } from '@playwright/test';
import { GLOBE_MIN_FPS } from '../../src/ui/globeRules';
import { launchFlight, toMarsOrbit } from './helpers';

// The GPU draws, as on a real phone; the CPU is throttled 4× below (headless Chromium otherwise renders WebGL in
// software, which measures the CPU twice).
test.use({ launchOptions: { args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] } });

const fpsNow = (page: Page) => page.evaluate(() => Number((document.querySelector('[data-globe="3d"]') as HTMLElement | null)?.dataset.fps ?? 'NaN'));
const modeNow = async (page: Page) => ((await page.locator('.sci-globe-host').getAttribute('class'))?.includes(' 3d') ? '3d' : '2d');

test('3D globe on a throttled phone: fast enough at rest and in a camera ease, or the flat globe', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'the throttled-phone check runs on the mobile project');
  test.setTimeout(240_000);
  await launchFlight(page, true);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await toMarsOrbit(page);
  // The watchdog judges two seconds after the first (spec: two slow seconds in a row fall back).
  await page.waitForTimeout(5000);
  await expect(page.locator('.sci-globe-host')).toBeVisible();
  let mode = await modeNow(page);
  const rest = await fpsNow(page);
  console.log(`throttled phone at rest: ${mode === '3d' ? `3D at ${rest} fps` : 'fell back to the flat globe'}`);
  if (mode === '3d') expect(rest).toBeGreaterThanOrEqual(GLOBE_MIN_FPS);
  else await expect(page.locator('.sci-globe-disc')).toBeVisible();
  await page.screenshot({ path: `test-results/shots/globe-throttled-${info.project.name}.png` });

  // A camera ease: Phobos pulls the camera back from the surface target (about a second).
  const handle = page.getByRole('button', { name: 'Science targets' });
  await handle.click();
  await page.locator('.sci-card', { hasText: 'PHOBOS' }).first().click();
  await handle.click();
  await handle.click();
  await page.waitForTimeout(1100);
  mode = await modeNow(page);
  const easing = await fpsNow(page);
  console.log(`throttled phone in a camera ease: ${mode === '3d' ? `3D at ${easing} fps` : 'fell back to the flat globe'}`);
  if (mode === '3d') expect(easing).toBeGreaterThanOrEqual(GLOBE_MIN_FPS);
  else await expect(page.locator('.sci-globe-disc')).toBeVisible();
  await page.screenshot({ path: `test-results/shots/globe-throttled-ease-${info.project.name}.png` });
});
