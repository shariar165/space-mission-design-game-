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
  { file: 'Signal Delay - Fly and Survive.dc.html', name: 'fly', desk: '1a', phone: '1b', jumps: ['CRUISE', 'DANGER CARD', 'ORDER IN FLIGHT', 'ROBOT REPLIES', 'RESULT', 'SCIENCE TARGETS', 'DOWNLINK'] },
  { file: 'Signal Delay - Pack.dc.html', name: 'pack', desk: '2a', phone: '2b' },
  { file: 'Signal Delay - Home.dc.html', name: 'home', desk: '4a', phone: '4b' },
  { file: 'Signal Delay - Home.dc.html', name: 'daily', desk: '5a', phone: '5b' },
  { file: 'Signal Delay - Notebook.dc.html', name: 'notebook', desk: '6a', phone: '6b' },
];

/** Fly jump buttons → shot names (kept the same as the game shots in fly.spec.ts). */
const JUMP_SHOT: Record<string, string> = { 'ORDER IN FLIGHT': 'signal-in-flight', 'ROBOT REPLIES': 'robot-replies', RESULT: 'result-arrives' };

for (const s of SCREENS) {
  test(`design ${s.name}`, async ({ page }, info) => {
    await open(page, s.file);
    const id = info.project.name === 'mobile' ? s.phone : s.desk;
    if (!s.jumps) {
      await shoot(page, id, s.name, info.project.name);
      return;
    }
    for (const j of s.jumps) {
      await page.getByRole('button', { name: j, exact: true }).click();
      await page.waitForTimeout(j === 'RESULT' ? 4000 : j === 'DOWNLINK' ? 9000 : 1200); // the downlink waits for the pass, then prints
      await shoot(page, id, `${s.name}-${JUMP_SHOT[j] ?? j.toLowerCase().replace(/\s+/g, '-')}`, info.project.name);
    }
  });
}

// Name Your Robot (screen 00): the typed intro, then a suggestion launched and its first words.
test('design name', async ({ page }, info) => {
  await open(page, 'Signal Delay - Name Your Robot.dc.html');
  const id = info.project.name === 'mobile' ? '0b' : '0a';
  await page.waitForTimeout(1500);
  await shoot(page, id, 'name', info.project.name);
  const f = frame(page, id);
  await f.getByRole('button', { name: /VOYA/ }).click();
  await f.getByRole('button', { name: /LAUNCH INTO TODAY/ }).click();
  await page.waitForTimeout(2500);
  await shoot(page, id, 'name-launched', info.project.name);
});

// Mission Report (screen 03): the MISSION ALBUM for each ending, then the FINAL TRANSMISSION teletype under it,
// then the report.
test('design report', async ({ page }, info) => {
  await open(page, 'Signal Delay - Mission Report.dc.html');
  const mobile = info.project.name === 'mobile';
  const id = mobile ? '3b' : '3a';
  /** The phone frame scrolls: put its nth section (0 album, 1 transmission, 2 report) at the top. */
  const scrollPhone = (n: number) =>
    frame(page, id)
      .locator(':scope > div')
      .evaluate((el, k) => {
        const kids = Array.from(el.children) as HTMLElement[];
        el.scrollTop = kids[k]?.offsetTop ?? 0;
      }, n);
  for (const ending of ['LOST', 'EXTENDED', 'COMPLETE']) {
    const suffix = ending === 'COMPLETE' ? '' : `-${ending.toLowerCase()}`;
    await page.getByRole('button', { name: ending, exact: true }).click();
    await page.waitForTimeout(2000);
    await shoot(page, id, `report-album${suffix}`, info.project.name);
    if (mobile) await scrollPhone(1);
    else await page.getByRole('button', { name: /FEED THE PAPER · FINAL TRANSMISSION/ }).click();
    await page.waitForTimeout(11_000); // the lines type one after another
    await shoot(page, id, `report-final${suffix}`, info.project.name);
  }
  if (mobile) await scrollPhone(2);
  else await page.getByRole('button', { name: /FEED THE PAPER · MISSION REPORT/ }).click();
  await page.waitForTimeout(12_000); // the comic prints panel by panel
  await shoot(page, id, 'report', info.project.name);
});
