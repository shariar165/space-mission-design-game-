// Game shots of Team Mode (spec: Team mode; design: Signal Delay - Team Setup.dc.html, T1 and T2), to compare with
// docs/design/signal-delay/shots/team-*.png. Run: npm run shots -- team
import { test, type Page } from '@playwright/test';
import { routeDonki } from './helpers';

const SEEN = ['coach', 'name', 'cold-open', 'brief:mars', 'launch:mars'];

async function openTeam(page: Page) {
  await page.addInitScript((seen) => {
    localStorage.setItem('sd.seen', JSON.stringify(seen));
    localStorage.setItem('mdt.mode', 'cadet');
  }, SEEN);
  await routeDonki(page);
  await page.goto('/');
  await page.getByRole('button', { name: /^TEAM: / }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

const shot = (page: Page, name: string, project: string) => page.screenshot({ path: `test-results/shots/${name}-${project}.png` });

test('team setup', async ({ page }, info) => {
  await openTeam(page);
  await shot(page, 'team-setup', info.project.name);
  // two players: each holds two roles
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.waitForTimeout(300);
  await shot(page, 'team-setup-duo', info.project.name);
});

test('team objective', async ({ page }, info) => {
  await openTeam(page);
  await page.getByRole('button', { name: 'NEXT · OBJECTIVE' }).click();
  await page.waitForTimeout(800); // the target pictures load
  await shot(page, 'team-objective-pick', info.project.name);
  // the design's state: the FD picked the atmosphere, the Engineer agrees, Science objects, Comms has not voted
  await page.getByRole('button', { name: /STUDY THE ATMOSPHERE/ }).click();
  await page.getByRole('button', { name: 'SPACECRAFT ENGINEER: AGREE' }).click();
  await page.getByRole('button', { name: 'SCIENCE LEAD: OBJECT' }).click();
  await page.waitForTimeout(300);
  await shot(page, 'team-objective', info.project.name);
  await page.getByRole('button', { name: 'COMMS & OPS: AGREE' }).click();
  await page.getByRole('button', { name: 'OVERRULE · FINAL CALL' }).click();
  await page.waitForTimeout(300);
  await shot(page, 'team-objective-locked', info.project.name);
});

test('team pack', async ({ page }, info) => {
  await openTeam(page);
  await page.getByRole('button', { name: 'NEXT · OBJECTIVE' }).click();
  await page.getByRole('button', { name: /STUDY THE ATMOSPHERE/ }).click();
  for (const r of ['SPACECRAFT ENGINEER', 'SCIENCE LEAD', 'COMMS & OPS']) await page.getByRole('button', { name: `${r}: AGREE` }).click();
  await page.getByRole('button', { name: 'LOCK OBJECTIVE' }).click();
  await page.getByRole('button', { name: 'NEXT · PACK' }).click();
  await page.waitForTimeout(1500); // the launch calendar works out its days
  // a few messages on the team line, as in the design
  for (const [as, say] of [['SPACECRAFT ENGINEER', 'NEED MORE POWER'], ['SCIENCE LEAD', 'SCIENCE FIRST'], ['COMMS & OPS', 'TOO HEAVY'], ['FLIGHT DIRECTOR', 'GOOD CALL']]) {
    await page.getByRole('button', { name: `Speak as ${as}` }).click();
    await page.getByRole('button', { name: say, exact: true }).click();
  }
  await shot(page, 'team-pack', info.project.name);
  // pack every part that still fits, to go over a limit
  for (let i = 0; i < 12; i++) {
    const fits = page.locator('.pk-tray-card:not(.nofit)');
    if ((await fits.count()) === 0) break;
    await fits.first().click();
  }
  await page.waitForTimeout(800);
  await shot(page, 'team-pack-full', info.project.name);
  if (info.project.name === 'mobile') await page.screenshot({ path: 'test-results/shots/team-pack-full-page-mobile.png', fullPage: true });
});
