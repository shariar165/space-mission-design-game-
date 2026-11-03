// The Online Mission Room on the real relay (spec: Online room): the Supabase project in src/data/online.json, no
// bridge. Opt-in, since it needs the network and the live project: ONLINE_LIVE=1 npx playwright test online-live
// --project=desktop. One host context and three phones join one room, vote on the objective, launch, vote on the first
// danger card, lose a phone's network and get it back, and finish; then the host closes and the phones show the
// resume code. It proves the relay carries the protocol; online.spec.ts covers the screens and shots.
import { expect, test, type Browser, type Page } from '@playwright/test';
import { flyToEnd, routeDonki } from './helpers';

test.use({ actionTimeout: 30_000, navigationTimeout: 30_000 });

const SEEN = ['coach', 'name', 'cold-open', 'brief:mars', 'launch:mars'];

async function open(browser: Browser, phone: boolean, url = '/') {
  const context = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript((seen) => {
    localStorage.setItem('sd.seen', JSON.stringify(seen));
    localStorage.setItem('mdt.mode', 'cadet');
  }, SEEN);
  await routeDonki(page);
  await page.goto(url);
  return { context, page };
}

test('online room on the live relay: a host and three phones', async ({ browser }, info) => {
  test.skip(!process.env.ONLINE_LIVE, 'set ONLINE_LIVE=1 to play a room through the real relay');
  test.skip(info.project.name !== 'desktop', 'the test makes its own host and phone contexts');
  test.setTimeout(600_000);
  const { page: host } = await open(browser, false, '/?seed=2013');
  const phones = await Promise.all([0, 1, 2].map(() => open(browser, true)));
  const [fd, sci, eng] = phones.map((p) => p.page) as [Page, Page, Page];
  const engContext = phones[2]!.context;
  const pages: [string, Page][] = [['host', host], ['fd', fd], ['sci', sci], ['eng', eng]];
  for (const [name, p] of pages) p.on('console', (m) => m.type() !== 'debug' && console.log(`[${name}] ${m.type()}: ${m.text()}`));
  try {

  await host.getByRole('button', { name: /^TEAM: / }).click();
  await host.getByRole('button', { name: /^ONLINE ROOM/ }).click();
  await host.getByRole('button', { name: 'NEXT · OPEN ROOM' }).click();
  // the code reads "…" while the relay connects
  await expect(host.locator('.ol-code')).toHaveText(/^[A-Z]{4}-[A-Z0-9]{3}$/, { timeout: 30_000 });
  const code = (await host.locator('.ol-code').textContent())!;

  for (const [p, role] of [
    [fd, 'FLIGHT DIRECTOR'],
    [sci, 'SCIENCE LEAD'],
    [eng, 'SPACECRAFT ENGINEER'],
  ] as const) {
    await p.getByRole('button', { name: /^JOIN: / }).click();
    await p.getByLabel('Room code').fill(code);
    const key = p.getByRole('button', { name: new RegExp(`^${role}`) });
    await expect(key).toBeEnabled({ timeout: 30_000 });
    await key.click();
    await p.getByRole('button', { name: `JOIN AS ${role}` }).click();
    await expect(p.getByText('WAITING FOR THE FLIGHT DIRECTOR TO START')).toBeVisible({ timeout: 30_000 });
  }

  // the objective, voted on the phones (Comms & Ops is nobody's: it goes to the Flight Director). START once the host
  // has every pick (over a real network a pick takes a moment; in class the host screen's slots show it)
  await expect(host.getByText('EMPTY: COM. START NOW AND COMET HOLDS THEM.')).toBeVisible({ timeout: 30_000 });
  await host.getByRole('button', { name: 'START MISSION' }).click();
  await fd.getByRole('button', { name: /^STUDY THE ATMOSPHERE/ }).click({ timeout: 30_000 });
  // Comms & Ops agrees by itself: the Flight Director's phone holds it
  for (const p of [sci, eng]) {
    const agree = p.locator('.ol-voice').getByRole('button', { name: 'AGREE' });
    await expect(agree).toBeEnabled({ timeout: 30_000 });
    await agree.click();
  }
  const lock = fd.getByRole('button', { name: 'LOCK OBJECTIVE' });
  await expect(lock).toBeEnabled({ timeout: 30_000 });
  await lock.click();

  const launch = fd.getByRole('button', { name: 'LAUNCH', exact: true });
  await expect(launch).toBeEnabled({ timeout: 60_000 });
  await launch.click();
  await host.getByRole('img', { name: /Map: your robot/ }).waitFor({ timeout: 60_000 });

  // fly to the first danger card; the phones vote; the Flight Director calls
  const card = host.getByRole('dialog', { name: /DANGER CARD/ });
  for (let i = 0; i < 200 && !(await card.isVisible()); i++) {
    const cont = host.getByRole('button', { name: 'CONTINUE ▸' });
    if (await cont.isVisible()) await cont.click();
    else if (await host.getByRole('dialog', { name: /PLAN AHEAD/ }).isVisible()) await host.locator('.dc-choice:not([disabled])').first().click();
    else {
      const next = host.getByRole('button', { name: 'Next event' });
      if ((await next.isVisible()) && (await next.isEnabled())) await next.click();
    }
    await host.waitForTimeout(250);
  }
  await expect(card).toBeVisible();
  // whoever's turn it is recommends; then each voter taps once (a second tap would take the vote back)
  let rec: Page | undefined;
  await expect
    .poll(async () => {
      for (const p of [fd, sci, eng]) if (await p.getByText('YOUR TURN · RECOMMEND').isVisible()) rec = p;
      return rec !== undefined;
    }, { timeout: 30_000 })
    .toBe(true);
  await rec!.locator('.ol-choice').first().click();
  for (const p of [sci, eng, fd].filter((x) => x !== rec)) {
    const vote = p.getByText('YOUR TURN · VOTE');
    if (await vote.waitFor({ timeout: 10_000 }).then(() => true, () => false)) await p.locator('.ol-choice').first().click();
  }
  await expect(fd.getByText('YOUR TURN · MAKE THE FINAL CALL')).toBeVisible({ timeout: 30_000 });
  await fd.locator('.ol-tally-row').first().click();
  await fd.getByRole('button', { name: /^FINAL CALL/ }).click();
  await expect(fd.getByText('YOUR TURN · MAKE THE FINAL CALL')).toBeHidden({ timeout: 30_000 });

  // a phone loses its network: the host holds its role; the network comes back and the phone catches up
  await engContext.setOffline(true);
  await expect(host.getByRole('dialog', { name: 'RECONNECTING' })).toBeVisible({ timeout: 60_000 });
  await engContext.setOffline(false);
  await expect(host.getByRole('dialog', { name: 'RECONNECTING' })).toBeHidden({ timeout: 60_000 });

  // the card's result may be up by now (a real reconnect takes some seconds)
  const finish = host.getByRole('button', { name: 'FINISH MISSION ▸▸' }).first();
  for (let i = 0; i < 20 && !(await finish.isVisible()); i++) {
    const cont = host.getByRole('button', { name: 'CONTINUE ▸' });
    if (await cont.isVisible()) await cont.click();
    await host.waitForTimeout(500);
  }
  await finish.click();
  await host.getByRole('button', { name: 'FINISH MISSION ▸▸' }).last().click();
  await flyToEnd(host, false);
  for (const p of [fd, sci, eng]) await expect(p.getByText('MISSION OVER · THE REPORT IS ON THE BIG SCREEN')).toBeVisible({ timeout: 60_000 });

  // the host screen closes: the phones show the resume code
  await host.close();
  for (const p of [fd, sci, eng]) await expect(p.getByText('THE HOST SCREEN CLOSED')).toBeVisible({ timeout: 90_000 });
  } catch (e) {
    for (const [name, p] of pages) if (!p.isClosed()) console.log(`---- ${name}:\n${(await p.locator('body').innerText().catch(() => '')).slice(0, 1500)}`);
    throw e;
  }
});
