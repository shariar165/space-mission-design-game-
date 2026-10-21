// Game shots of PACK (Mars level) and its Launch Day step, at the project's size. Run: npm run shots -- pack
import { expect, test } from '@playwright/test';

test('pack', async ({ page }, info) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('mdt.mode', 'cadet');
      localStorage.setItem('sd.seen', JSON.stringify(['coach', 'name', 'brief:moon-1', 'brief:moon-2', 'brief:moon-3', 'brief:mars', 'brief:venus', 'brief:bennu', 'brief:jupiter', 'launch:moon-1', 'launch:moon-2', 'launch:moon-3', 'launch:mars', 'launch:venus', 'launch:bennu', 'launch:jupiter', 'launch:free', 'launch:daily']));
      localStorage.setItem('mdt.progress', JSON.stringify({ 'moon-1': 1, 'moon-2': 1, 'moon-3': 1 }));
    } catch {
      /* ignore */
    }
  });
  await page.goto('/?seed=2013');
  await page.getByRole('button', { name: 'CHOOSE A MISSION ▸' }).click();
  await page.getByRole('button', { name: /^Red Planet/ }).click();
  await expect(page.getByRole('button', { name: 'CHANGE ▸' })).toBeEnabled({ timeout: 60_000 }); // the launch days are worked out
  // pack the design's starter extras: shield, solar, battery, autopilot
  for (const name of ['Pack Radiation shield', 'Pack Extra solar panel', 'Pack Big battery', 'Pack Autopilot chip']) {
    const b = page.getByRole('button', { name, exact: true });
    if (await b.isVisible()) await b.click();
  }
  await page.getByRole('switch', { name: 'Arm' }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `test-results/shots/pack-${info.project.name}.png`, fullPage: info.project.name === 'mobile' });
  // CHANGE ▸: the Launch Day step
  await page.getByRole('button', { name: 'CHANGE ▸' }).click();
  await expect(page.getByRole('radiogroup', { name: 'Launch day' }).getByRole('radio').first()).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `test-results/shots/launch-day-${info.project.name}.png`, fullPage: info.project.name === 'mobile' });
});
