// Shared steps for the screenshot specs.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

/** Play a flight to its end: answer every card with its first choice, retire at the extension, open the report. */
export async function flyToEnd(page: Page, mobile: boolean) {
  for (let i = 0; i < 400; i++) {
    if (await page.getByRole('list', { name: 'How each danger went' }).isVisible()) return;
    const report = page.getByRole('button', { name: 'SEE MISSION REPORT ▸' });
    if (await report.isVisible()) return report.click();
    const retire = page.getByRole('button', { name: 'Retire the craft' });
    if (await retire.isVisible()) {
      await retire.click();
      continue;
    }
    const cont = page.getByRole('button', { name: 'CONTINUE ▸' });
    if (await cont.isVisible()) {
      await cont.click();
      continue;
    }
    // Science Targets in Mars orbit (no pictures here): skip it and fly on. The key is disabled while the globe zooms
    // in or back out to the map; clicking it then would wait on a button that is about to leave the page.
    const sci = page.locator('.sci-done');
    if (await sci.isVisible()) {
      if (await sci.isEnabled()) await sci.click();
      else await page.waitForTimeout(200);
      continue;
    }
    if (await page.getByRole('dialog', { name: /DANGER CARD|PLAN AHEAD/ }).isVisible()) {
      // In a solar conjunction no order can be sent: every choice is disabled, so the robot decides.
      const decide = page.getByRole('button', { name: /^LET THE ROBOT DECIDE/ });
      if ((await page.locator('.dc-choice:not([disabled])').count()) === 0 && (await decide.isVisible())) {
        await decide.click();
        await page.waitForTimeout(300);
        continue;
      }
      // ← picks the left choice on a desktop; when that one cannot be paid for (a used spare), click the first that can.
      const leftOpen = await page.locator('.dc-choice.side-0:not([disabled])').count();
      if (mobile || leftOpen === 0) await page.locator('.dc-choice:not([disabled])').first().click();
      else await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(300);
      continue;
    }
    if ((await page.locator('.fly-transit').isVisible()) || (await page.locator('.fly-reply').isVisible())) {
      await page.waitForTimeout(400);
      continue;
    }
    const next = page.getByRole('button', { name: 'Next event' });
    if ((await next.isVisible()) && (await next.isEnabled())) await next.click();
    else await page.waitForTimeout(200);
  }
  throw new Error('mission did not end');
}


/**
 * Serve data/donki-latest.json from the documented-format sample (tests/fixtures/donki), its dates moved so the
 * week ends yesterday: the Daily flies live weather with the sample's storms on any day the shots are taken.
 */
export async function routeDonki(page: Page) {
  const text = readFileSync(join(process.cwd(), 'tests/fixtures/donki/documented-format-sample.json'), 'utf8');
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const shift = today - Date.parse('2030-01-08T00:00:00Z');
  const moved = text.replace(/2030-01-(\d\d)/g, (d) => new Date(Date.parse(`${d}T00:00:00Z`) + shift).toISOString().slice(0, 10));
  await page.route('**/data/donki-latest.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: moved }));
}

/** Engineer Build Bay → Launch, then flip to Cadet inside the flight (the designs show Cadet). Seed 2013. */
export async function launchFlight(page: Page, mobile: boolean, engineer = false) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('mdt.mode', 'engineer');
      localStorage.setItem('sd.seen', JSON.stringify(['coach', 'name', 'brief:moon-1', 'brief:moon-2', 'brief:moon-3', 'brief:mars', 'brief:venus', 'brief:bennu', 'brief:jupiter', 'launch:moon-1', 'launch:moon-2', 'launch:moon-3', 'launch:mars', 'launch:venus', 'launch:bennu', 'launch:jupiter', 'launch:free', 'launch:daily']));
      localStorage.setItem('sd.robot', JSON.stringify({ name: 'VOYA' }));
      localStorage.removeItem('mdt.ops');
    } catch {
      /* ignore */
    }
  });
  await page.goto('/?seed=2013');
  await page.getByRole('button', { name: 'Launch', exact: true }).click();
  await page.getByRole('img', { name: /Map: your robot/ }).waitFor({ timeout: 60_000 });
  if (!engineer) await page.getByRole(mobile ? 'button' : 'switch', { name: mobile ? 'Engineer mode (short)' : 'Engineer mode' }).click();
  await page.evaluate(() => document.fonts.ready);
}

/** Next event (leaving dangers to the robot) until the Science Targets panel is up in Mars orbit. */
export async function toMarsOrbit(page: Page) {
  for (let i = 0; i < 300; i++) {
    if (await page.locator('.sci').isVisible()) return;
    const cont = page.getByRole('button', { name: 'CONTINUE ▸' });
    if (await cont.isVisible()) {
      await cont.click();
      continue;
    }
    const decide = page.getByRole('button', { name: /^LET THE ROBOT DECIDE/ });
    if (await decide.isVisible()) {
      await decide.click();
      await page.waitForTimeout(200);
      continue;
    }
    // A planning card (the eclipse season) has no "robot decides": take its first open choice.
    const choice = page.locator('.dc-choice:not([disabled])').first();
    if (await choice.isVisible()) {
      await choice.click();
      await page.waitForTimeout(200);
      continue;
    }
    const next = page.getByRole('button', { name: 'Next event' });
    if ((await next.isVisible()) && (await next.isEnabled())) await next.click();
    else await page.waitForTimeout(250);
  }
  throw new Error('never reached Mars orbit');
}
