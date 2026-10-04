// Reference shots of the Claude Design mockups (docs/design/signal-delay), one per screen state, at the
// same sizes as the game shots. Run with `npm run shots -- design`.
import { expect, test, type Page } from '@playwright/test';

const DIR = '/docs/design/signal-delay/';
const OUT = 'docs/design/signal-delay/shots/';

async function open(page: Page, file: string) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  await page.goto(DIR + encodeURIComponent(file));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
}

/** The device frame inside a labelled design artboard (`<div id="1a">` → label row + frame). */
const frame = (page: Page, id: string) => page.locator(`[id="${id}"] > div:nth-child(2)`);

async function shoot(page: Page, id: string, name: string, project: string) {
  const f = frame(page, id);
  await expect(f).toBeVisible();
  await f.screenshot({ path: `${OUT}${name}-${project}.png`, animations: 'allow' });
}

const SCREENS: { file: string; name: string; desk: string; phone: string; jumps?: string[] }[] = [
  { file: 'Signal Delay - Fly and Survive.dc.html', name: 'fly', desk: '1a', phone: '1b', jumps: ['CRUISE', 'DANGER CARD', 'SIGNAL IN FLIGHT', 'RESULT ARRIVES'] },
  { file: 'Signal Delay - Pack.dc.html', name: 'pack', desk: '2a', phone: '2b' },
  { file: 'Signal Delay - Mission Report.dc.html', name: 'report', desk: '3a', phone: '3b' },
  { file: 'Signal Delay - Home.dc.html', name: 'home', desk: '4a', phone: '4b' },
  { file: 'Signal Delay - Home.dc.html', name: 'daily', desk: '5a', phone: '5b' },
  { file: 'Signal Delay - Notebook.dc.html', name: 'notebook', desk: '6a', phone: '6b' },
];

for (const s of SCREENS) {
  test(`design ${s.name}`, async ({ page }, info) => {
    await open(page, s.file);
    const id = info.project.name === 'mobile' ? s.phone : s.desk;
    if (!s.jumps) {
      if (s.name === 'report') await page.waitForTimeout(12_000); // the comic prints panel by panel
      await shoot(page, id, s.name, info.project.name);
      return;
    }
    for (const j of s.jumps) {
      await page.getByRole('button', { name: j, exact: true }).click();
      await page.waitForTimeout(j === 'RESULT ARRIVES' ? 4000 : 1200);
      await shoot(page, id, `${s.name}-${j.toLowerCase().replace(/\s+/g, '-')}`, info.project.name);
    }
  });
}
