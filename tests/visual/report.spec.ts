// Game shots of the MISSION REPORT after a whole flown mission (Mars, seed 2013). Run: npm run shots -- report
import { expect, test } from '@playwright/test';
import { flyToEnd } from './helpers';

test('report', async ({ page }, info) => {
  test.setTimeout(420_000);
  const mobile = info.project.name === 'mobile';
  await page.addInitScript(() => {
    try {
      localStorage.setItem('mdt.mode', 'cadet');
      localStorage.setItem('mdt.progress', JSON.stringify({ 'moon-1': 1, 'moon-2': 1, 'moon-3': 1 }));
      localStorage.removeItem('mdt.ops');
    } catch {
      /* ignore */
    }
  });
  await page.goto('/?seed=2013');
  await page.getByRole('button', { name: 'CHOOSE A MISSION ▸' }).click();
  await page.getByRole('button', { name: /^Red Planet/ }).click();
  await expect(page.getByRole('radiogroup', { name: 'Launch day' }).getByRole('radio').first()).toBeVisible({ timeout: 60_000 });
  for (const name of ['Pack Radiation shield', 'Pack Extra solar panel', 'Pack Big battery', 'Pack Autopilot chip']) {
    const b = page.getByRole('button', { name, exact: true });
    if (await b.isVisible()) await b.click();
  }
  await page.getByRole('switch', { name: 'Arm' }).click();
  await page.getByRole('button', { name: 'LAUNCH', exact: true }).click();
  await expect(page.getByRole('img', { name: /Map: your robot/ })).toBeVisible({ timeout: 60_000 });
  await flyToEnd(page, mobile);
  await expect(page.getByRole('heading', { name: /MISSION/ })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(11_000); // the comic prints panel by panel
  await page.screenshot({ path: `test-results/shots/report-${info.project.name}.png`, fullPage: mobile });
  if (!mobile) {
    await page.getByRole('switch', { name: 'Engineer mode' }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `test-results/shots/report-engineer-${info.project.name}.png`, fullPage: true });
  }
});
