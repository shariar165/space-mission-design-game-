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

/**
 * Text inside `selector` that is cut off: every text run's box must sit inside each ancestor that clips it (overflow
 * hidden / clip: both axes; a scroll box: across only, since it scrolls down) and inside the window across. Returns
 * one line per clipped run ("SHIELD UP: left 11px past main.sd-crt.fly-crt"); empty when everything fits. Screen-reader-only
 * text (a box of a pixel or two) is skipped. `scrollers`: boxes meant to scroll sideways (a strip of keys), where
 * text past the edge is reached by scrolling.
 */
export async function clippedText(page: Page, selector: string, scrollers: string[] = []): Promise<string[]> {
  return page.evaluate(([sel, sideways]) => {
    const root = document.querySelector(sel);
    if (!root) return [`nothing matches ${sel}`];
    const name = (a: Element) => a.tagName.toLowerCase() + (a.classList.length ? `.${[...a.classList].join('.')}` : '');
    const out: string[] = [];
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const text = (n.textContent ?? '').trim();
      const el = n.parentElement;
      if (!text || !el || el.getClientRects().length === 0) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      let tiny = false;
      for (let a: Element | null = el; a; a = a.parentElement) {
        const b = a.getBoundingClientRect();
        if (b.width <= 2 || b.height <= 2 || getComputedStyle(a).visibility === 'hidden') tiny = true;
      }
      if (tiny) continue;
      const miss = (box: { left: number; right: number; top: number; bottom: number }, both: boolean, by: string) => {
        const d = [
          ['left', box.left - r.left],
          ['right', r.right - box.right],
          ...(both ? [['top', box.top - r.top], ['bottom', r.bottom - box.bottom]] : []),
        ] as [string, number][];
        for (const [side, px] of d) if (px > 1) out.push(`${text.slice(0, 40)}: ${side} ${Math.round(px)}px past ${by}`);
      };
      const across = sideways!.some((x) => el.closest(x));
      if (!across) miss({ left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight }, false, 'the window');
      // only the ancestors that contain the box clip it: past an absolute box, the next positioned one; past a fixed
      // box, none (the window)
      // inside a scroll box, text below it is reached by scrolling (outer boxes then only clip across), but text above
      // its scrolled-to top never is
      let skip = false;
      let scrolls = false;
      for (let a: Element | null = el; a && a !== document.documentElement; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (skip && cs.position === 'static') continue;
        skip = false;
        const o = [cs.overflowX, cs.overflowY];
        const b = a.getBoundingClientRect();
        if (across) {
          // inside a sideways strip only the up-and-down cut counts
          if (!scrolls && o.some((x) => x === 'hidden' || x === 'clip') && (b.top - r.top > 1 || r.bottom - b.bottom > 1)) out.push(`${text.slice(0, 40)}: cut top or bottom by ${name(a)}`);
          if (o.some((x) => x === 'auto' || x === 'scroll') && !sideways!.some((x) => a.matches(x))) scrolls = true;
        } else if (o.some((x) => x === 'auto' || x === 'scroll')) {
          miss(b, false, name(a));
          if (b.top - a.scrollTop - r.top > 1) out.push(`${text.slice(0, 40)}: above the top of ${name(a)}, out of scroll reach`);
          scrolls = true;
        } else if (o.some((x) => x === 'hidden' || x === 'clip')) miss(b, !scrolls, name(a));
        if (cs.position === 'fixed') break;
        if (cs.position === 'absolute') skip = true;
      }
    }
    return [...new Set(out)];
  }, [selector, scrollers] as const);
}
