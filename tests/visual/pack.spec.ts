// Game shots of PACK (Mars level) and its Launch Day step, at the project's size. Run: npm run shots -- pack
// Red Planet asks for the mission objective first (spec UI rule 56): the briefing before and after the pick, then the
// plate with no matching part (surface on the starter) and with one (atmosphere: the starter's sniffer).
import { expect, test } from '@playwright/test';
import { clippedText } from './helpers';

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
  const p = info.project.name;
  const brief = page.getByRole('dialog', { name: 'Mission briefing' });
  await expect(brief.getByRole('radio')).toHaveCount(3);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/shots/objective-brief-${p}.png` });
  expect(await clippedText(page, '.sd-brief', ['.sd-brief'])).toEqual([]);
  await brief.getByRole('radio', { name: /^MAP THE SURFACE/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `test-results/shots/objective-brief-picked-${p}.png` });
  await brief.getByRole('button', { name: 'GOT IT ▸' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/shots/pack-objective-${p}.png`, fullPage: p === 'mobile' });
  expect(await clippedText(page, '.pk-obj')).toEqual([]);
  // back to the briefing: atmosphere, which the starter's sniffer already does
  await page.getByRole('button', { name: 'Change the objective' }).click();
  await brief.getByRole('radio', { name: /^STUDY THE ATMOSPHERE/ }).click();
  await brief.getByRole('button', { name: 'GOT IT ▸' }).click();
  // pack the design's starter extras: shield, solar, battery, autopilot
  for (const name of ['Pack Radiation shield', 'Pack Extra solar panel', 'Pack Big battery', 'Pack Autopilot chip']) {
    const b = page.getByRole('button', { name, exact: true });
    if (await b.isVisible()) await b.click();
  }
  await page.getByRole('switch', { name: 'Arm' }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `test-results/shots/pack-${info.project.name}.png`, fullPage: info.project.name === 'mobile' });
  expect(await clippedText(page, '.pk-obj')).toEqual([]);
  // CHANGE ▸: the Launch Day step
  await page.getByRole('button', { name: 'CHANGE ▸' }).click();
  await expect(page.getByRole('radiogroup', { name: 'Launch day' }).getByRole('radio').first()).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `test-results/shots/launch-day-${info.project.name}.png`, fullPage: info.project.name === 'mobile' });
});

// MISSION LIMITS on Cloud Diver (spec UI rule 57): the starter nearly at its budget, the camera previewed (it would go
// over), then packed (over budget: launch blocked). Run: npm run shots -- pack
test('pack: Cloud Diver budget', async ({ page }, info) => {
  const p = info.project.name;
  await page.addInitScript(() => {
    try {
      localStorage.setItem('mdt.mode', 'cadet');
      localStorage.setItem('sd.seen', JSON.stringify(['coach', 'name', 'brief:venus', 'launch:venus']));
      localStorage.setItem('mdt.progress', JSON.stringify({ 'moon-1': 1, 'moon-2': 1, 'moon-3': 1, mars: 1 }));
    } catch {
      /* ignore */
    }
  });
  await page.goto('/?seed=2013');
  await page.getByRole('button', { name: 'CHOOSE A MISSION ▸' }).click();
  await page.getByRole('button', { name: /^Cloud Diver/ }).click();
  await expect(page.getByRole('button', { name: 'CHANGE ▸' })).toBeEnabled({ timeout: 60_000 });
  await expect(page.getByRole('region', { name: 'Mission limits' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/shots/limits-${p}.png`, fullPage: p === 'mobile' });
  expect(await clippedText(page, '.ml')).toEqual([]);
  const camera = page.getByRole('button', { name: 'Pack Camera', exact: true });
  if (p !== 'mobile') {
    await camera.hover();
    await expect(page.getByText('IF YOU PACK: CAMERA')).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `test-results/shots/limits-preview-${p}.png` });
    expect(await clippedText(page, '.ml')).toEqual([]);
  }
  await camera.click();
  await page.mouse.move(700, 450);
  await expect(page.getByText('OVER BUDGET: TAKE SOMETHING OUT')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `test-results/shots/limits-over-${p}.png`, fullPage: p === 'mobile' });
  expect(await clippedText(page, '.ml')).toEqual([]);
});

// ROCKET (spec UI rule 58): Red Planet with the 411 picked (the weight limit rises, the budget pays 20 $M), then the
// Moon's shared ride on First Light. Run: npm run shots -- pack
test('pack: rocket choice', async ({ page }, info) => {
  const p = info.project.name;
  await page.addInitScript(() => {
    try {
      localStorage.setItem('mdt.mode', 'cadet');
      localStorage.setItem('sd.seen', JSON.stringify(['coach', 'name', 'brief:mars', 'brief:moon-1', 'launch:mars']));
      localStorage.setItem('sd.pack', JSON.stringify({ mars: { parts: ['computer', 'engine', 'sniffer'], objective: 'atmosphere' } }));
      localStorage.setItem('mdt.progress', JSON.stringify({ 'moon-1': 1, 'moon-2': 1, 'moon-3': 1 }));
    } catch {
      /* ignore */
    }
  });
  await page.goto('/?seed=2013');
  await page.getByRole('button', { name: 'CHOOSE A MISSION ▸' }).click();
  await page.getByRole('button', { name: /^Red Planet/ }).click();
  await expect(page.getByRole('button', { name: 'CHANGE ▸' })).toBeEnabled({ timeout: 60_000 });
  const rockets = page.getByRole('radiogroup', { name: 'Rocket' });
  await rockets.getByRole('radio', { name: /Atlas V 411/ }).click();
  await page.mouse.move(700, 450);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/shots/rocket-${p}.png`, fullPage: p === 'mobile' });
  expect(await clippedText(page, '.rk')).toEqual([]);
  await page.getByRole('button', { name: 'Back' }).first().click();
  await page.getByRole('button', { name: /^First Light/ }).click();
  await expect(page.getByRole('button', { name: 'CHANGE ▸' })).toBeEnabled({ timeout: 60_000 });
  await page.getByRole('radiogroup', { name: 'Rocket' }).getByRole('radio', { name: /SHARED RIDE/ }).click();
  await page.mouse.move(700, 450);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/shots/rocket-ride-${p}.png`, fullPage: p === 'mobile' });
  expect(await clippedText(page, '.rk')).toEqual([]);
});
