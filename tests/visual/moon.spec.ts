// Game shots of the Moon globe (spec: UI rules 44–46; design 3d/Moon Globe.html) in lunar orbit on each Moon level,
// in 3D and with the flat globe, at the project's size (1440 × 900 and 390 × 844):
// - Moon 1: the globe and the orbit, with the shadow arc;
// - Moon 2: plus the station-keeping tag;
// - Moon 3: the four targets, then Tsiolkovskiy picked (the far side) and an OBSERVE order on it.
// Run: npm run shots -- moon
import { expect, test, type Page } from '@playwright/test';
import { toMarsOrbit } from './helpers';

const OUT = 'test-results/shots/';

// Let the browser draw with the GPU (headless Chromium otherwise renders WebGL in software, too slowly for the 3D
// globe at 1440 × 900, and the globe rightly falls back to the flat one).
test.use({ launchOptions: { args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] } });

const LEVELS = [
  { n: 1, title: /^First Light/ },
  { n: 2, title: /^Heavy Lifting/ },
  { n: 3, title: /^Full Build/ },
] as const;

/** Cadet: pick the Moon level, launch on the best day with the starter's packing, fly until the orbit panel is up. */
async function toMoonOrbit(page: Page, title: RegExp, globe: '3d' | '2d') {
  await page.addInitScript((mode) => {
    try {
      localStorage.setItem('mdt.mode', 'cadet');
      localStorage.setItem('sd.seen', JSON.stringify(['coach', 'name', 'brief:moon-1', 'brief:moon-2', 'brief:moon-3', 'launch:moon-1', 'launch:moon-2', 'launch:moon-3']));
      localStorage.setItem('mdt.progress', JSON.stringify({ 'moon-1': 1, 'moon-2': 1 }));
      localStorage.setItem('sd.robot', JSON.stringify({ name: 'VOYA' }));
      localStorage.setItem('sd.globe', JSON.stringify({ mode }));
      localStorage.removeItem('mdt.ops');
    } catch {
      /* ignore */
    }
  }, globe);
  await page.goto('/?seed=2013');
  await page.getByRole('button', { name: 'CHOOSE A MISSION ▸' }).click();
  await page.getByRole('button', { name: title }).click();
  await expect(page.getByRole('button', { name: 'CHANGE ▸' })).toBeEnabled({ timeout: 60_000 });
  await page.getByRole('switch', { name: 'Arm' }).click();
  await page.getByRole('button', { name: 'LAUNCH', exact: true }).click();
  await expect(page.getByRole('img', { name: /Map: your robot/ })).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await toMarsOrbit(page);
  await page.waitForFunction(() => !document.querySelector('.fly.zooming'));
}

/** Pick a target from the list (on the phone: open the sheet, pick, and let it fall back to its peek). */
async function pick(page: Page, mobile: boolean, name: string) {
  if (mobile) {
    const handle = page.getByRole('button', { name: 'Science targets' });
    await handle.click();
    await page.locator('.sci-card', { hasText: name }).first().click();
    await handle.click();
    await handle.click();
  } else await page.locator('.sci-card', { hasText: name }).first().click();
}

for (const globe of ['3d', '2d'] as const) {
  for (const l of LEVELS) {
    test(`moon ${l.n}: the Moon globe (${globe})`, async ({ page }, info) => {
      test.setTimeout(240_000);
      const mobile = info.project.name === 'mobile';
      const p = `${info.project.name}${globe === '2d' ? '-2d' : ''}`;
      await toMoonOrbit(page, l.title, globe);
      await page.waitForTimeout(2500);
      const fps = await page.evaluate(() => (document.querySelector('[data-globe="3d"]') as HTMLElement | null)?.dataset.fps ?? null);
      console.log(`moon ${l.n} ${p}: ${fps === null ? '2D' : `3D at ${fps} fps`}`);
      if (globe === '3d') expect(fps).not.toBeNull();
      await expect(page.locator('.sci-globe.moon')).toBeVisible();
      await expect(page.locator('.sci-link')).toHaveText(/LINK · (LOCKED|LOST)/);
      await page.screenshot({ path: `${OUT}moon-${l.n}-${p}.png` });
      // The orbiter laps the ring: catch it behind the Moon too (the link is lost and the signal line broken).
      await page.locator('.sci-globe.moon[data-link="lost"]').waitFor({ timeout: 40_000 });
      await page.screenshot({ path: `${OUT}moon-${l.n}-lost-${p}.png` });
      if (l.n !== 3) return;

      // Moon 3: Tsiolkovskiy, on the far side; then OBSERVE it: the robot shoots it alone, out of Earth's sight.
      await pick(page, mobile, 'TSIOLKOVSKIY');
      await page.waitForTimeout(1300);
      await expect(page.locator('.sci-globe')).toHaveAttribute('data-focus', 'tsiolkovskiy');
      await page.screenshot({ path: `${OUT}moon-3-far-${p}.png` });
      await page.locator('.sci-observe').click();
      await page.locator('.sci-globe[data-flyover]').waitFor({ timeout: 30_000 });
      await page.waitForTimeout(650);
      await page.screenshot({ path: `${OUT}moon-3-observe-${p}.png` });
    });
  }
}
