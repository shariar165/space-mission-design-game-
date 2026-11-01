// No danger card text is cut off (spec UI rule 25: the card is the whole decision). The first danger cards of a
// solo flight, Cadet and Engineer (the Engineer card carries the equations), at 1440 × 900 and 390 × 844.
// Run: npx playwright test cardfit
import { expect, test } from '@playwright/test';
import { clippedText, launchFlight } from './helpers';

const OUT = 'test-results/shots/';
const CARDS = 3;

for (const engineer of [false, true]) {
  test(`solo danger cards fit (${engineer ? 'engineer' : 'cadet'})`, async ({ page }, info) => {
    const mobile = info.project.name === 'mobile';
    await launchFlight(page, mobile, engineer);
    const card = page.getByRole('dialog', { name: /DANGER CARD/ });
    for (let k = 0; k < CARDS; k++) {
      for (let i = 0; i < 60 && !(await card.isVisible()); i++) {
        const cont = page.getByRole('button', { name: 'CONTINUE ▸' });
        if (await cont.isVisible()) await cont.click();
        const next = page.getByRole('button', { name: 'Next event' });
        if ((await next.isVisible()) && (await next.isEnabled())) await next.click();
        await page.waitForTimeout(250);
      }
      await expect(card).toBeVisible();
      await page.waitForTimeout(1200);
      const cut = await clippedText(page, '.dc-overlay');
      await page.screenshot({ path: `${OUT}cardfit-${engineer ? 'eng' : 'cadet'}-${k}-${info.project.name}.png` });
      expect(cut, `card ${k + 1}`).toEqual([]);
      await page.getByRole('button', { name: /^LET THE ROBOT DECIDE/ }).click();
      await expect(card).toBeHidden();
    }
  });
}
