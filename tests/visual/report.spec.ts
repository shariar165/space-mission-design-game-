// Game shots of the MISSION REPORT after a whole flown mission (Mars, seed 2013): the final transmission, then the report. Run: npm run shots -- report
import { expect, test } from '@playwright/test';
import { flyToEnd } from './helpers';

test('report', async ({ page }, info) => {
  test.setTimeout(420_000);
  const mobile = info.project.name === 'mobile';
  await page.addInitScript(() => {
    try {
      localStorage.setItem('mdt.mode', 'cadet');
      localStorage.setItem('sd.seen', JSON.stringify(['coach', 'name', 'brief:moon-1', 'brief:moon-2', 'brief:moon-3', 'brief:mars', 'brief:venus', 'brief:bennu', 'brief:jupiter', 'launch:moon-1', 'launch:moon-2', 'launch:moon-3', 'launch:mars', 'launch:venus', 'launch:bennu', 'launch:jupiter', 'launch:free', 'launch:daily']));
      localStorage.setItem('mdt.progress', JSON.stringify({ 'moon-1': 1, 'moon-2': 1, 'moon-3': 1 }));
      localStorage.removeItem('mdt.ops');
    } catch {
      /* ignore */
    }
  });
  await page.goto('/?seed=2013');
  await page.getByRole('button', { name: 'CHOOSE A MISSION ▸' }).click();
  await page.getByRole('button', { name: /^Red Planet/ }).click();
  await expect(page.getByRole('button', { name: 'CHANGE ▸' })).toBeEnabled({ timeout: 60_000 }); // the launch days are worked out
  for (const name of ['Pack Radiation shield', 'Pack Extra solar panel', 'Pack Big battery', 'Pack Autopilot chip']) {
    const b = page.getByRole('button', { name, exact: true });
    if (await b.isVisible()) await b.click();
  }
  await page.getByRole('switch', { name: 'Arm' }).click();
  await page.getByRole('button', { name: 'LAUNCH', exact: true }).click();
  await expect(page.getByRole('img', { name: /Map: your robot/ })).toBeVisible({ timeout: 60_000 });
  await flyToEnd(page, mobile);
  await page.evaluate(() => document.fonts.ready);
  // At Mars the report opens with the Mission Album (spec: UI rule 43). On a desktop its FEED THE PAPER leads to the
  // final transmission; on the phone the two are stacked on one page.
  const album = page.getByRole('region', { name: 'Mission album' });
  if (await album.isVisible()) {
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `test-results/shots/report-album-flight-${info.project.name}.png` });
    const feed = album.getByRole('button', { name: /FEED THE PAPER/ });
    if (await feed.count()) await feed.click();
  }
  await expect(page.getByRole('region', { name: 'Final transmission' })).toBeVisible();
  await page.waitForTimeout(15_000); // the robot's last words print line by line
  await page.screenshot({ path: `test-results/shots/report-final-${info.project.name}.png` });
  await page.getByRole('region', { name: 'Final transmission' }).getByRole('button', { name: /FEED THE PAPER/ }).click();
  await page.waitForTimeout(11_000); // the comic prints panel by panel
  await page.screenshot({ path: `test-results/shots/report-${info.project.name}.png`, fullPage: mobile });
  if (!mobile) {
    await page.getByRole('switch', { name: 'Engineer mode' }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `test-results/shots/report-engineer-${info.project.name}.png`, fullPage: true });
  }
});
