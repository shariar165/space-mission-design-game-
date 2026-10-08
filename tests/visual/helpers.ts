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
    if (await page.getByRole('dialog', { name: /DANGER CARD|PLAN AHEAD/ }).isVisible()) {
      if (mobile) await page.locator('.dc-choice:not([disabled])').first().click();
      else await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(300);
      continue;
    }
    if (await page.locator('.fly-transit').isVisible()) {
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
