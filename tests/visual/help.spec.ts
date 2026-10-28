// Game shots of the help a new player gets: naming the robot, the mission briefing (Pack), the how-to-fly coach and the
// "leave this flight?" confirmation (Fly). Run: npm run shots -- help
import { expect, test } from '@playwright/test';

const OUT = 'test-results/shots/';

test('briefing, coach and back', async ({ page }, info) => {
  const p = info.project.name;
  await page.addInitScript(() => {
    try {
      localStorage.setItem('mdt.mode', 'cadet');
      localStorage.removeItem('mdt.ops');
      // A new player who has already seen the cold open (coldopen.spec.ts shoots it).
      localStorage.setItem('sd.seen', JSON.stringify(['cold-open']));
    } catch {
      /* ignore */
    }
  });
  await page.goto('/?seed=2013');
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: /^Play: mission/ }).click();
  // A new player names the robot first (design screen 00).
  await expect(page.getByRole('textbox', { name: 'Robot name' })).toBeAttached();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}name-${p}.png` });
  await page.getByRole('button', { name: /^SUGGESTION 1|^VOYA$/ }).click();
  await page.getByRole('button', { name: /LAUNCH INTO TODAY/ }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}name-launched-${p}.png` });
  await page.getByRole('button', { name: /^LOAD / }).click();
  await expect(page.getByRole('dialog', { name: 'Mission briefing' })).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}help-briefing-${p}.png` });
  await page.getByRole('button', { name: 'GOT IT ▸' }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}help-pack-checklist-${p}.png` });
  await page.getByRole('switch', { name: 'Arm' }).click();
  const go = page.getByRole('button', { name: 'LAUNCH' });
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
