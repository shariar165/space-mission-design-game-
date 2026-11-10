// The README's pictures (docs/images/), from the game as it is: the Red Planet Pack (objective, mission limits,
// rocket and orbit), a danger card, and the Mission Report of a flight that brought science home. Desktop only.
// Run: npx playwright test readme --project=desktop   (the team vote picture comes from team.spec.ts "team fly")
import { expect, test, type Page } from '@playwright/test';
import { clippedText, toMarsOrbit } from './helpers';

const IMG = 'docs/images/';

async function redPlanet(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('mdt.mode', 'cadet');
      localStorage.setItem('sd.seen', JSON.stringify(['coach', 'name', 'cold-open', 'brief:mars', 'launch:mars']));
      localStorage.setItem('sd.robot', JSON.stringify({ name: 'PIP' }));
      localStorage.setItem('mdt.progress', JSON.stringify({ 'moon-1': 3, 'moon-2': 3, 'moon-3': 2 }));
      localStorage.setItem('sd.pack', JSON.stringify({ mars: { parts: ['computer', 'engine', 'camera', 'shield', 'solar', 'autopilot'], objective: 'surface', rocket: 'atlas-v-401', orbit: 'maven' } }));
      localStorage.removeItem('mdt.ops');
    } catch {
      /* ignore */
    }
  });
  await page.goto('/?seed=2013');
  await page.getByRole('button', { name: 'CHOOSE A MISSION ▸' }).click();
  await page.getByRole('button', { name: /^Red Planet/ }).click();
  await expect(page.getByRole('button', { name: 'CHANGE ▸' })).toBeEnabled({ timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
}

test.skip(({ viewport }) => (viewport?.width ?? 0) < 1000, 'README pictures are desktop shots');

test('readme: pack', async ({ page }) => {
  await redPlanet(page);
  await page.getByRole('tab', { name: 'ROCKET' }).click();
  await page.mouse.move(700, 450);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${IMG}pack.png` });
  expect(await clippedText(page, '.pk-deck')).toEqual([]);
});

test('readme: a flight that brings science home', async ({ page }) => {
  test.setTimeout(420_000);
  await redPlanet(page);
  await page.getByRole('switch', { name: 'Arm' }).click();
  await page.getByRole('button', { name: 'LAUNCH', exact: true }).click();
  await expect(page.getByRole('img', { name: /Map: your robot/ })).toBeVisible({ timeout: 60_000 });
  // the first danger card
  for (let i = 0; i < 60 && !(await page.getByRole('dialog', { name: /DANGER CARD/ }).isVisible()); i++) {
    const next = page.getByRole('button', { name: 'Next event' });
    if ((await next.isVisible()) && (await next.isEnabled())) await next.click();
    else await page.waitForTimeout(250);
  }
  await expect(page.getByRole('dialog', { name: /DANGER CARD/ })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${IMG}fly-danger-card.png` });
  // at Mars: order the surface targets (the objective), then let the robot finish the mission
  await toMarsOrbit(page);
  for (const name of ['OLYMPUS MONS', 'VALLES MARINERIS', 'NORTH POLAR CAP', 'PHOBOS', 'THIN AIR AT THE LIMB']) {
    await page.locator('.sci-card', { hasText: name }).first().click();
    const observe = page.locator('.sci-observe');
    if (await observe.isEnabled()) await observe.click();
    await page.waitForTimeout(400);
  }
  await page.locator('.sci-done').click();
  await page.getByRole('button', { name: /^FINISH MISSION/ }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /FINISH/ }).last().click();
  await page.getByRole('button', { name: 'SEE MISSION REPORT ▸' }).click({ timeout: 120_000 });
  // the album first, then the robot's last words, then the comic
  const album = page.getByRole('region', { name: 'Mission album' });
  if (await album.isVisible()) await album.getByRole('button', { name: /FEED THE PAPER/ }).click();
  await expect(page.getByRole('region', { name: 'Final transmission' })).toBeVisible();
  await page.waitForTimeout(15_000);
  await page.getByRole('region', { name: 'Final transmission' }).getByRole('button', { name: /FEED THE PAPER/ }).click();
  await page.waitForTimeout(11_000);
  await page.locator('.rp-comic').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -90));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${IMG}report.png` });
  expect(await clippedText(page, '.rp-comic')).toEqual([]);
});
