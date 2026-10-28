// Game shots of the cold open (spec UI rule 47): a brand-new player's first launch, at 1440 × 900 and 390 × 844.
// - coldopen-wait: the burn and "signal expected" printed, the wait on the flat trace;
// - coldopen-lost: — NO SIGNAL —;
// - coldopen-moral: the second screen (pounds and newtons, every order arrives late) with the report's credit;
// - coldopen-name: where it goes on to, Name Your Robot;
// - coldopen-still: reduced motion, every line printed whole.
// Run: npm run shots -- coldopen
import { expect, test, type Page } from '@playwright/test';

const OUT = 'test-results/shots/';

async function newPlayer(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('mdt.mode', 'cadet');
      localStorage.removeItem('sd.seen');
      localStorage.removeItem('sd.robot');
      localStorage.removeItem('mdt.ops');
    } catch {
      /* ignore */
    }
  });
  await page.goto('/?seed=2013');
  await page.evaluate(() => document.fonts.ready);
}

const screenAt = (page: Page, beat: string) => page.locator(`.co-screen[data-beat="${beat}"]`).waitFor({ timeout: 30_000 });
/** Wait until a line has printed its last character. */
const printed = (page: Page, cls: string, end: RegExp) => expect(page.locator(`.co-line.${cls} [aria-hidden]`)).toHaveText(end, { timeout: 10_000 });

test('the cold open', async ({ page }, info) => {
  test.setTimeout(90_000);
  const p = info.project.name;
  await newPlayer(page);
  await expect(page.getByRole('button', { name: 'SKIP ▸' })).toBeVisible();
  await screenAt(page, 'wait');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}coldopen-wait-${p}.png` });
  await screenAt(page, 'lost');
  await printed(page, 'lost', /— NO SIGNAL —█$/);
  await page.screenshot({ path: `${OUT}coldopen-lost-${p}.png` });
  await screenAt(page, 'moral');
  await printed(page, 'moral', /MAKE IT COUNT\.█$/);
  await page.screenshot({ path: `${OUT}coldopen-moral-${p}.png` });
  // it goes on to Name Your Robot by itself
  await expect(page.getByRole('textbox', { name: 'Robot name' })).toBeAttached({ timeout: 10_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}coldopen-name-${p}.png` });
});

test('the cold open, reduced motion', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await newPlayer(page);
  await screenAt(page, 'lost');
  await page.screenshot({ path: `${OUT}coldopen-still-${info.project.name}.png` });
  // six short beats: on to the name screen in under 4 s
  await expect(page.getByRole('textbox', { name: 'Robot name' })).toBeAttached({ timeout: 4_000 });
});
