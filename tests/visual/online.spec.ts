// The Online Mission Room played by several browsers (spec: Online room; design: Signal Delay - Online Room.dc.html,
// T6 and T7). One host context at 1440 × 900 and four phone contexts at 390 × 844 play one Mars mission: the phones
// join with the code, pick their roles, vote on the objective, launch, and vote on a danger card while the host screen
// flies; then a phone drops and comes back, the flight finishes, and the host leaves. The pages talk through this
// test process (src/ui/online/bridgeRelay.ts), so no network is needed. Shots go to test-results/shots/ to compare
// with docs/design/signal-delay/shots/ (team-online-*, online-*). Run: npm run shots -- online
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { clippedText, flyToEnd, routeDonki } from './helpers';

const SEEN = ['coach', 'name', 'cold-open', 'brief:mars', 'launch:mars'];
const OUT = 'test-results/shots/';

type Peer = { key: string; kind: 'host' | 'phone' };
type Out = { kind: 'join'; channel: string; me: Peer } | { kind: 'send'; channel: string; from: string; msg: unknown } | { kind: 'leave'; channel: string; key: string };

/** The relay: passes each page's messages to the other pages on its channel, and keeps presence. */
class Bridge {
  private channels = new Map<string, Map<string, { page: Page; me: Peer }>>();
  private cut = new Set<Page>();
  offline = false;

  async attach(page: Page) {
    await page.exposeFunction('__sdRelayOut', (json: string) => this.out(page, JSON.parse(json) as Out));
  }

  private async tell(page: Page, e: unknown) {
    if (this.cut.has(page) || page.isClosed()) return;
    await page.evaluate((j) => (window as unknown as { __sdRelayIn?: (s: string) => void }).__sdRelayIn?.(j), JSON.stringify(e)).catch(() => undefined);
  }

  private members(channel: string) {
    let m = this.channels.get(channel);
    if (!m) this.channels.set(channel, (m = new Map()));
    return m;
  }

  private async peers(channel: string) {
    const m = this.members(channel);
    const peers = [...m.values()].filter((x) => !this.cut.has(x.page) && !x.page.isClosed()).map((x) => x.me);
    for (const x of m.values()) await this.tell(x.page, { kind: 'peers', channel, peers });
  }

  private async out(page: Page, e: Out) {
    if (this.cut.has(page)) return;
    if (e.kind === 'join') {
      if (this.offline) return this.tell(page, { kind: 'status', channel: e.channel, key: e.me.key, status: 'offline' });
      this.members(e.channel).set(e.me.key, { page, me: e.me });
      await this.tell(page, { kind: 'status', channel: e.channel, key: e.me.key, status: 'open' });
      return this.peers(e.channel);
    }
    if (e.kind === 'leave') {
      this.members(e.channel).delete(e.key);
      return this.peers(e.channel);
    }
    for (const [key, x] of this.members(e.channel)) if (key !== e.from) await this.tell(x.page, { kind: 'msg', channel: e.channel, to: key, msg: e.msg });
  }

  /** A page loses its network: it leaves presence and hears nothing. */
  async drop(page: Page) {
    for (const [channel, m] of this.channels)
      for (const x of m.values())
        if (x.page === page) {
          await this.tell(page, { kind: 'status', channel, key: x.me.key, status: 'connecting' });
          this.cut.add(page);
          await this.peers(channel);
        }
  }

  async heal(page: Page) {
    this.cut.delete(page);
    for (const [channel, m] of this.channels)
      for (const x of m.values())
        if (x.page === page) {
          await this.tell(page, { kind: 'status', channel, key: x.me.key, status: 'open' });
          await this.peers(channel);
        }
  }

  /** A page closed: it leaves every channel. */
  async gone(page: Page) {
    for (const [channel, m] of this.channels) {
      for (const [k, x] of m) if (x.page === page) m.delete(k);
      await this.peers(channel);
    }
  }
}

async function open(browser: Browser, bridge: Bridge, phone: boolean, url = '/'): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await bridge.attach(page);
  await page.addInitScript((seen) => {
    localStorage.setItem('sd.seen', JSON.stringify(seen));
    localStorage.setItem('mdt.mode', 'cadet');
  }, SEEN);
  await routeDonki(page);
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}

const shoot = (page: Page, name: string) => page.screenshot({ path: `${OUT}${name}.png` });

/** No text on a controller is cut off. */
async function fits(page: Page) {
  expect(await clippedText(page, '.ol-phone-frame')).toEqual([]);
}

test('online room: one Mars mission, a host screen and four phones', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'the test makes its own host and phone contexts');
  test.setTimeout(600_000);
  const bridge = new Bridge();
  // a fixed seed (App ?seed=): the same mission, and the same first danger card, on every run
  const { page: host } = await open(browser, bridge, false, '/?seed=2013');
  const phones = await Promise.all([0, 1, 2, 3].map(() => open(browser, bridge, true)));
  const [fd, sci, eng, com] = phones.map((p) => p.page) as [Page, Page, Page, Page];

  // ---- T6a: the host opens a room ----
  await host.getByRole('button', { name: /^TEAM: / }).click();
  await host.getByRole('button', { name: /^ONLINE ROOM/ }).click();
  await host.getByRole('button', { name: 'NEXT · OPEN ROOM' }).click();
  const code = (await host.locator('.ol-code').textContent({ timeout: 20_000 }))!;
  expect(code).toMatch(/^[A-Z]{4}-[A-Z0-9]{3}$/);

  // ---- T6b: the phones join in the design's order and pick their roles ----
  const roles: [Page, string][] = [
    [fd, 'FLIGHT DIRECTOR'],
    [sci, 'SCIENCE LEAD'],
    [eng, 'SPACECRAFT ENGINEER'],
    [com, 'COMMS & OPS'],
  ];
  for (const [p, role] of roles) {
    await p.getByRole('button', { name: /^JOIN: / }).click();
    await p.getByLabel('Room code').fill(code);
    const key = p.getByRole('button', { name: new RegExp(`^${role}`) });
    await expect(key).toBeEnabled({ timeout: 20_000 });
    await key.click();
    if (p === sci) {
      await p.waitForTimeout(300);
      await shoot(p, 'team-online-mobile');
      await fits(p);
    }
    await p.getByRole('button', { name: `JOIN AS ${role}` }).click();
    await expect(p.getByText('WAITING FOR THE FLIGHT DIRECTOR TO START')).toBeVisible();
  }
  await expect(host.getByText('ALL FOUR ROLES FILLED. READY.')).toBeVisible();
  await shoot(host, 'team-online-desktop');
  await shoot(sci, 'online-waiting-mobile');
  await fits(sci);

  // ---- the objective, voted on the phones ----
  await host.getByRole('button', { name: 'START MISSION' }).click();
  await fd.getByRole('button', { name: /^STUDY THE ATMOSPHERE/ }).click();
  for (const p of [sci, eng, com]) {
    const agree = p.locator('.ol-voice').getByRole('button', { name: 'AGREE' });
    await expect(agree).toBeEnabled({ timeout: 20_000 });
    await agree.click();
  }
  const lock = fd.getByRole('button', { name: 'LOCK OBJECTIVE' });
  await expect(lock).toBeEnabled({ timeout: 20_000 });
  await lock.click();

  // ---- packing: the Engineer adds the extra tank; the Flight Director launches ----
  await expect(eng.locator('.ol-parts')).toBeVisible({ timeout: 30_000 });
  const launch = fd.getByRole('button', { name: 'LAUNCH', exact: true });
  await expect(launch).toBeEnabled({ timeout: 60_000 });
  await launch.click();
  await host.getByRole('img', { name: /Map: your robot/ }).waitFor({ timeout: 60_000 });

  // ---- T6c–f: the host flies to the first danger card; the phones vote ----
  const card = host.getByRole('dialog', { name: /DANGER CARD/ });
  for (let i = 0; i < 200 && !(await card.isVisible()); i++) {
    // the eclipse planning card and a result go by the way flyToEnd takes them (helpers.ts)
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
  const all = [fd, sci, eng, com];
  // whoever's turn it is to recommend does so
  let rec: Page | undefined;
  await expect.poll(async () => {
    for (const p of all) if (await p.getByText('YOUR TURN · RECOMMEND').isVisible()) rec = p;
    return rec !== undefined;
  }, { timeout: 30_000 }).toBe(true);
  await rec!.locator('.ol-choice').first().click();
  // the first voter votes too, so the design's mid-vote state is on screen
  const voters = [sci, eng, com].filter((p) => p !== rec);
  await expect(voters[0]!.getByText('YOUR TURN · VOTE')).toBeVisible({ timeout: 20_000 });
  await voters[0]!.locator('.ol-choice').last().click();
  await fd.waitForTimeout(1500);
  for (const [p, name] of [
    [fd, 'online-fd-mobile'],
    [eng, 'online-eng-mobile'],
    [sci, 'online-sci-mobile'],
    [com, 'online-com-mobile'],
  ] as const) {
    await shoot(p, name);
    await fits(p);
  }
  await voters[1]!.locator('.ol-choice').first().click();
  await expect(fd.getByText('YOUR TURN · MAKE THE FINAL CALL')).toBeVisible({ timeout: 20_000 });
  await fd.locator('.ol-tally-row').first().click();
  await fd.getByRole('button', { name: /^FINAL CALL/ }).click();
  // the call settles the card: the Flight Director's phone has nothing left to call
  await expect(fd.getByText('YOUR TURN · MAKE THE FINAL CALL')).toBeHidden({ timeout: 20_000 });

  // ---- T7a / T7c: a phone drops; the host holds the clock and its role; the phone comes back ----
  await bridge.drop(eng);
  await expect(host.getByRole('dialog', { name: 'RECONNECTING' })).toBeVisible({ timeout: 20_000 });
  await expect(eng.getByText('SIGNAL LOST')).toBeVisible();
  await host.waitForTimeout(1200);
  await shoot(host, 'online-reconnecting-desktop');
  await shoot(eng, 'online-reconnecting-mobile');
  await bridge.heal(eng);
  await expect(host.getByRole('dialog', { name: 'RECONNECTING' })).toBeHidden({ timeout: 20_000 });

  // ---- the flight ends: every phone shows the report is on the big screen ----
  await host.getByRole('button', { name: 'FINISH MISSION ▸▸' }).first().click();
  await host.getByRole('button', { name: 'FINISH MISSION ▸▸' }).last().click();
  await flyToEnd(host, false);
  for (const p of all) await expect(p.getByText('MISSION OVER · THE REPORT IS ON THE BIG SCREEN')).toBeVisible({ timeout: 60_000 });

  // ---- T7d: the host screen closes; after its grace the phones show the resume code ----
  await host.close();
  await bridge.gone(host);
  for (const p of all) await expect(p.getByText('THE HOST SCREEN CLOSED')).toBeVisible({ timeout: 40_000 });
  await shoot(com, 'online-host-left-mobile');
  await fits(com);

  // ---- T7a / T7e: no relay: the host and a phone offer local co-op ----
  bridge.offline = true;
  const { page: lone } = await open(browser, bridge, false);
  await lone.getByRole('button', { name: /^TEAM: / }).click();
  await lone.getByRole('button', { name: /^ONLINE ROOM/ }).click();
  await lone.getByRole('button', { name: 'NEXT · OPEN ROOM' }).click();
  await expect(lone.getByText('OFFLINE', { exact: true })).toBeVisible({ timeout: 20_000 });
  await shoot(lone, 'online-offline-desktop');
  const { page: lost } = await open(browser, bridge, true);
  await lost.getByRole('button', { name: /^JOIN: / }).click();
  await lost.getByLabel('Room code').fill(code);
  await expect(lost.getByText('RELAY OFFLINE')).toBeVisible({ timeout: 20_000 });
  await shoot(lost, 'online-offline-mobile');
  await fits(lost);
});
