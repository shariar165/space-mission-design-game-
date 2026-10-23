// Game shots of Science Targets and the DOWNLINK drawer (design screen 01: SCIENCE TARGETS, DOWNLINK), at the
// project's size. Run: npm run shots -- science
import { expect, test } from '@playwright/test';
import { launchFlight, toMarsOrbit } from './helpers';

const OUT = 'test-results/shots/';

test('science targets and downlink', async ({ page }, info) => {
  const mobile = info.project.name === 'mobile';
  const p = info.project.name;
  await launchFlight(page, mobile);
  await toMarsOrbit(page);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}fly-science-targets-${p}.png` });
  // Order three pictures, as the design's DOWNLINK state has.
  for (const name of ['VALLES MARINERIS', 'PHOBOS', 'OLYMPUS MONS']) {
    await page.locator('.sci-card', { hasText: name }).first().click();
    const observe = page.locator('.sci-observe');
    if (await observe.isEnabled()) await observe.click();
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: `${OUT}fly-science-ordered-${p}.png` });
  await page.locator('.sci-done').click();
  // Open the drawer and fly on (N = NEXT EVENT) until every picture is home.
  await page.getByRole('button', { name: /DOWNLINK/ }).first().click();
  const drawer = page.getByRole('region', { name: 'DOWNLINK' });
  await expect(drawer).toBeVisible();
  for (let i = 0; i < 60 && !(await drawer.getByText('ALL IMAGES HOME').count()); i++) {
    const cont = page.getByRole('button', { name: /CONTINUE ▸|^LET THE ROBOT DECIDE/ });
    if (await cont.first().isVisible()) await cont.first().click();
    await page.keyboard.press('n');
    await page.waitForTimeout(300);
  }
  await expect(drawer.getByText('ALL IMAGES HOME')).toBeVisible();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}fly-downlink-printing-${p}.png` });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${OUT}fly-downlink-${p}.png` });
});
