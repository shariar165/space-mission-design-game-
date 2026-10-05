// Game shots of HOME, the DAILY share card and the NOTEBOOK. Run: npm run shots -- screens
import { expect, test } from '@playwright/test';
import { flyToEnd } from './helpers';

const seedStorage = (extra: Record<string, string> = {}) => {
  const items = { 'mdt.mode': 'cadet', 'mdt.progress': JSON.stringify({ 'moon-1': 2, 'moon-2': 1, 'moon-3': 3, 'rescue-mco': 2 }), ...extra };
  return items;
};

test('home', async ({ page }, info) => {
  await page.addInitScript((items) => {
    for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
  }, seedStorage());
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(4500); // the pitch types out
  await page.screenshot({ path: `test-results/shots/home-${info.project.name}.png` });
});

test('notebook', async ({ page }, info) => {
  await page.addInitScript((items) => {
    for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
  }, seedStorage({ 'sd.notebook': JSON.stringify({ hazards: { 'solar-storm': 87, 'memory-corruption': 149 }, conjunction: true, eclipse: true }) }));
  await page.goto('/');
  await page.getByRole('button', { name: /^NOTEBOOK/ }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `test-results/shots/notebook-${info.project.name}.png` });
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: /^Lesson 1:/ }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/shots/notebook-sheet-mobile.png` });
  }
});

test('daily', async ({ page }, info) => {
  test.setTimeout(420_000);
  const mobile = info.project.name === 'mobile';
  await page.addInitScript((items) => {
    for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
    localStorage.removeItem('sd.daily');
    localStorage.removeItem('mdt.ops');
  }, seedStorage());
  await page.goto('/');
  await page.getByRole('button', { name: /^DAILY MISSION/ }).click();
  await expect(page.getByRole('img', { name: /Map: your robot/ })).toBeVisible({ timeout: 60_000 });
  await flyToEnd(page, mobile);
  await expect(page.getByRole('list', { name: 'How each danger went' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `test-results/shots/daily-${info.project.name}.png` });
});
