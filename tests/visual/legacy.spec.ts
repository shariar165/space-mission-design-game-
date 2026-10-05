// Shots of the screens reskinned in the Signal Delay palette without a mockup of their own:
// the mission map, Rescue History and the Engineer Build Bay. Run: npm run shots -- legacy
import { test } from '@playwright/test';

test('map, rescue, build bay', async ({ page }, info) => {
  await page.addInitScript(() => {
    localStorage.setItem('mdt.mode', 'cadet');
    localStorage.setItem('sd.seen', JSON.stringify(['coach', 'brief:moon-1', 'brief:moon-2', 'brief:moon-3', 'brief:mars', 'brief:venus', 'brief:bennu', 'brief:jupiter', 'launch:moon-1', 'launch:moon-2', 'launch:moon-3', 'launch:mars', 'launch:venus', 'launch:bennu', 'launch:jupiter', 'launch:free', 'launch:daily']));
    localStorage.setItem('mdt.progress', JSON.stringify({ 'moon-1': 2, 'moon-2': 1, 'moon-3': 3 }));
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'CHOOSE A MISSION ▸' }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/shots/map-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: /Rescue History/i }).first().click();
  await page.getByRole('button', { name: /Mars Climate Orbiter/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/shots/rescue-${info.project.name}.png`, fullPage: true });
  await page.goto('/');
  const mobile = info.project.name === 'mobile';
  await page.getByRole(mobile ? 'button' : 'switch', { name: mobile ? 'Engineer mode (short)' : 'Engineer mode' }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `test-results/shots/buildbay-${info.project.name}.png` });
});
