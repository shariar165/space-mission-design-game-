// Game shots of a solar storm on the Moon map (user report: the storm seemed to come from Earth). Seed 4 draws a
// solar storm about two months into a Moon flight. Shots: the card, the wave crossing from the Sun, the storm on
// the robot. Run: npm run shots -- storm
import { expect, test, type Page } from '@playwright/test';

const OUT = 'test-results/shots/';

async function launchMoon(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('mdt.mode', 'cadet');
      localStorage.setItem('sd.seen', JSON.stringify(['coach', 'brief:moon-1', 'brief:moon-2', 'brief:moon-3', 'brief:mars', 'brief:venus', 'brief:bennu', 'brief:jupiter', 'launch-moment']));
      localStorage.setItem('sd.sound', JSON.stringify({ on: false }));
      localStorage.removeItem('mdt.ops');
    } catch {
      /* ignore */
    }
  });
  await page.goto('/?seed=4');
  await page.getByRole('button', { name: 'CHOOSE A MISSION ▸' }).click();
  await page.getByRole('button', { name: /^First Light/ }).click();
  await expect(page.getByRole('radiogroup', { name: 'Launch day' }).getByRole('radio').first()).toBeVisible({ timeout: 60_000 });
  for (const name of ['Pack Extra solar panel', 'Pack Big battery']) {
    const b = page.getByRole('button', { name, exact: true });
    if (await b.isVisible()) await b.click();
  }
  await page.getByRole('switch', { name: 'Arm' }).click();
  await page.getByRole('button', { name: /LAUNCH/ }).last().click();
  await expect(page.getByRole('img', { name: /Map: your robot/ })).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
}

test('solar storm comes from the Sun', async ({ page }, info) => {
  const p = info.project.name;
  const mobile = p === 'mobile';
  await launchMoon(page);
  const skip = page.getByRole('button', { name: /SKIP/ });
  if (await skip.isVisible()) await skip.click();
  // Next event until the solar-storm card opens (answer any other card with its first choice).
  for (let i = 0; i < 60; i++) {
    const card = page.getByRole('dialog', { name: /DANGER CARD|PLAN AHEAD/ });
    if (await card.isVisible()) {
      if (/SOLAR STORM/.test((await card.textContent()) ?? '')) break;
      await page.locator('.dc-choice:not([disabled])').first().click();
      await page.waitForTimeout(400);
      continue;
    }
    const cont = page.getByRole('button', { name: 'CONTINUE ▸' });
    if (await cont.isVisible()) await cont.click();
    const next = page.getByRole('button', { name: 'Next event' });
    if ((await next.isVisible()) && (await next.isEnabled())) await next.click();
    await page.waitForTimeout(300);
  }
  await expect(page.getByRole('dialog', { name: /DANGER CARD/ })).toContainText('SOLAR STORM');
  await page.screenshot({ path: `${OUT}storm-card-${p}.png` });
  await page.locator('.dc-choice:not([disabled])').first().click();
  // The order crosses to the robot, then the wave crosses from the Sun at 10×.
  await expect(page.getByTestId('storm-wave')).toBeVisible({ timeout: 30_000 });
  for (let i = 0; i < 60; i++) {
    const cont = page.getByRole('button', { name: 'CONTINUE ▸' });
    if (await cont.isVisible()) await cont.click();
    const ten = page.getByRole('button', { name: '10× speed' });
    if ((await ten.isEnabled()) && (await ten.getAttribute('aria-pressed')) !== 'true') await ten.click();
    const cls = (await page.getByTestId('storm-wave').getAttribute('class').catch(() => '')) ?? '';
    const paths = await page.getByTestId('storm-wave').locator('path').count().catch(() => 0);
    if (cls.includes('coming') && paths >= 2) break;
    await page.waitForTimeout(150);
  }
  const pause = page.getByRole('button', { name: 'Pause' });
  if (await pause.isEnabled()) await pause.click({ timeout: 2000 }).catch(() => undefined);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}storm-wave-${p}.png` });
  // Run on until the storm is on the robot.
  for (let i = 0; i < 80; i++) {
    const cont = page.getByRole('button', { name: 'CONTINUE ▸' });
    if (await cont.isVisible()) await cont.click();
    const ten = page.getByRole('button', { name: '10× speed' });
    if ((await ten.isEnabled()) && (await ten.getAttribute('aria-pressed')) !== 'true') await ten.click();
    if (await page.locator('.crt-storm.hitting').isVisible()) break;
    await page.waitForTimeout(150);
  }
  if (await pause.isEnabled()) await pause.click({ timeout: 2000 }).catch(() => undefined);
  await page.waitForTimeout(mobile ? 500 : 300);
  await page.screenshot({ path: `${OUT}storm-hit-${p}.png` });
  // The robot's own report of the hit reaches Earth one light time later: its radio bubble.
  for (let i = 0; i < 40; i++) {
    const cont = page.getByRole('button', { name: 'CONTINUE ▸' });
    if (await cont.isVisible()) await cont.click();
    if (await page.locator('.fly-radio').isVisible()) break;
    const ten = page.getByRole('button', { name: '10× speed' });
    if ((await ten.isEnabled()) && (await ten.getAttribute('aria-pressed')) !== 'true') await ten.click();
    await page.waitForTimeout(100);
  }
  if (await pause.isEnabled()) await pause.click({ timeout: 2000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}storm-radio-${p}.png` });
});
