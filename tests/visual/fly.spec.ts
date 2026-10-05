// Game shots of FLY & SURVIVE in the design's four states (cruise, danger card, signal in flight, result),
// at the project's size. Run: npm run shots -- fly
import { expect, test, type Page } from '@playwright/test';

const OUT = 'test-results/shots/';

/** Engineer Build Bay → Launch → flip to Cadet inside the flight (the design shows Cadet). */
async function launch(page: Page, mobile: boolean, engineer = false) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('mdt.mode', 'engineer');
      localStorage.setItem('sd.seen', JSON.stringify(['coach', 'brief:moon-1', 'brief:moon-2', 'brief:moon-3', 'brief:mars', 'brief:venus', 'brief:bennu', 'brief:jupiter', 'launch:moon-1', 'launch:moon-2', 'launch:moon-3', 'launch:mars', 'launch:venus', 'launch:bennu', 'launch:jupiter', 'launch:free', 'launch:daily']));
      localStorage.removeItem('mdt.ops');
    } catch {
      /* ignore */
    }
  });
  await page.goto('/?seed=2013');
  await page.getByRole('button', { name: 'Launch', exact: true }).click();
  await expect(page.getByRole('img', { name: /Map: your robot/ })).toBeVisible({ timeout: 60_000 });
  if (!engineer) await page.getByRole(mobile ? 'button' : 'switch', { name: mobile ? 'Engineer mode (short)' : 'Engineer mode' }).click();
  await page.evaluate(() => document.fonts.ready);
}

async function toDanger(page: Page) {
  for (let i = 0; i < 40; i++) {
    if (await page.getByRole('dialog', { name: /DANGER CARD/ }).isVisible()) return;
    const next = page.getByRole('button', { name: 'Next event' });
    if (await next.isVisible()) await next.click();
    await page.waitForTimeout(250);
  }
  await expect(page.getByRole('dialog', { name: /DANGER CARD/ })).toBeVisible();
}

test('fly states', async ({ page }, info) => {
  const mobile = info.project.name === 'mobile';
  const p = info.project.name;
  await launch(page, mobile);
  await page.getByRole('button', { name: '10× speed' }).click();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}fly-cruise-${p}.png` });
  await toDanger(page);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}fly-danger-card-${p}.png` });
  await page.keyboard.press('ArrowLeft');
  if (mobile) {
    // the card covers the arrows on a phone; tap the left choice if the key did not land
    const first = page.locator('.dc-choice.side-0');
    if (await first.isVisible()) await first.click();
  }
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}fly-signal-in-flight-${p}.png` });
  await expect(page.getByRole('dialog', { name: 'Incoming message' })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}fly-result-arrives-${p}.png` });
});

test('fly engineer', async ({ page }, info) => {
  await launch(page, info.project.name === 'mobile', true);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}fly-engineer-${info.project.name}.png` });
});
