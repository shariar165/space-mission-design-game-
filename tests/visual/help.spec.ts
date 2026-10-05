// Game shots of the help a new player gets: the mission briefing (Pack), the how-to-fly coach and the
// "leave this flight?" confirmation (Fly). Run: npm run shots -- help
import { expect, test } from '@playwright/test';

const OUT = 'test-results/shots/';

test('briefing, coach and back', async ({ page }, info) => {
  const p = info.project.name;
  await page.addInitScript(() => {
    try {
      localStorage.setItem('mdt.mode', 'cadet');
      localStorage.removeItem('mdt.ops');
      localStorage.removeItem('sd.seen');
    } catch {
      /* ignore */
    }
  });
  await page.goto('/?seed=2013');
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: /^Play: mission/ }).click();
  await expect(page.getByRole('dialog', { name: 'Mission briefing' })).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}help-briefing-${p}.png` });
  await page.getByRole('button', { name: 'GOT IT ▸' }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}help-pack-checklist-${p}.png` });
  await page.getByRole('switch', { name: 'Arm' }).click();
  const go = page.getByRole('button', { name: 'LAUNCH' });
  if (await go.isDisabled()) await page.locator('.pk-day.good, .pk-day.soso').first().click();
  await go.click();
  // The first flight of a level opens with the launch countdown, then the coach.
  await expect(page.getByRole('dialog', { name: 'LAUNCH IN' })).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}help-countdown-${p}.png` });
  await expect(page.locator('.mo-launch.liftoff')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}help-liftoff-${p}.png` });
  await expect(page.getByRole('dialog', { name: 'HOW TO FLY' })).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}help-coach-${p}.png` });
  await page.getByRole('button', { name: 'SKIP' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}help-fly-paused-${p}.png` });
  await page.getByRole('button', { name: 'Back' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}help-leave-${p}.png` });
});
