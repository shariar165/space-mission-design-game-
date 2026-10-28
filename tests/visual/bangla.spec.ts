// Game shots in Bangla (spec UI rule 48), at 1440 × 900 and 390 × 844: the longer Bangla words must not break a
// layout. Each shot also checks that the page never scrolls sideways, and writes any key or label whose words spill
// out of it to test-results/shots/bn-spills.txt (to read beside the shots). Run: npm run shots -- bangla
import { appendFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const OUT = 'test-results/shots/';

/** A Bangla player: the language saved as বাংলা. */
async function banglaPlayer(page: Page, seen: string[] = ['cold-open'], robot?: string) {
  await page.addInitScript(
    ([s, r]) => {
      try {
        localStorage.setItem('mdt.mode', 'cadet');
        localStorage.removeItem('mdt.ops');
        localStorage.setItem('sd.lang', JSON.stringify({ lang: 'bn' }));
        localStorage.setItem('sd.seen', JSON.stringify(s));
        if (r) localStorage.setItem('sd.robot', JSON.stringify({ name: r }));
        else localStorage.removeItem('sd.robot');
      } catch {
        /* ignore */
      }
    },
    [seen, robot] as const,
  );
  await page.goto('/?seed=2013');
  await page.evaluate(() => document.fonts.ready);
}

/** Keys, labels and headings whose text runs past their own box (clipped or spilling), as "class: text". */
async function spills(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('button, a, h1, h2, h3, [class*="title"], [class*="label"], [class*="-k"]'))) {
      if (el.closest('svg')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue;
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'auto') out.push(`${el.className}: ${(el.textContent ?? '').trim().slice(0, 50)}`);
    }
    return out;
  });
}

/** Shoot, then check: no sideways scroll on the page, nothing spilling. */
async function shot(page: Page, name: string, project: string) {
  await page.screenshot({ path: `${OUT}bn-${name}-${project}.png` });
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, `${name}: the page scrolls sideways`).toBeLessThanOrEqual(0);
  const spilt = await spills(page);
  if (spilt.length) appendFileSync(`${OUT}bn-spills.txt`, [`${name}-${project}`, ...spilt.map((x) => `  ${x}`), ''].join('\n'));
}

test('Bangla: cold open, Home, naming the robot, the briefing and the coach', async ({ page }, info) => {
  test.setTimeout(120_000);
  const p = info.project.name;
  // A brand-new player: the cold open's gate, then its last screen.
  await banglaPlayer(page, []);
  await expect(page.getByRole('button', { name: '▶ বার্তা গ্রহণ করো' })).toBeVisible();
  await shot(page, 'coldopen-gate', p);
  await page.getByRole('button', { name: '▶ বার্তা গ্রহণ করো' }).click();
  await page.locator('.co-screen[data-beat="wait"]').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1200);
  await shot(page, 'coldopen-wait', p);
  await page.locator('.co-screen[data-beat="moral"]').waitFor({ timeout: 30_000 });
  await expect(page.locator('.co-line.moral [aria-hidden]')).toHaveText(/পাঠাও।█$/, { timeout: 10_000 });
  await shot(page, 'coldopen-moral', p);
  // It goes on to the name screen.
  await expect(page.getByRole('textbox', { name: 'রোবটের নাম' })).toBeAttached({ timeout: 10_000 });
  await page.waitForTimeout(2500);
  await shot(page, 'name', p);
  await page.getByRole('button', { name: /^বাদ দাও · নাম থাকুক/ }).click();
  // Home
  await expect(page.getByRole('button', { name: /^খেলো: মিশন/ })).toBeVisible();
  await page.waitForTimeout(800);
  await shot(page, 'home', p);
  await page.getByRole('button', { name: /^কীভাবে খেলবে:/ }).click();
  await page.waitForTimeout(400);
  await shot(page, 'howto', p);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^তোমার ক্রু ফাইল খোলো/ }).first().click();
  await page.waitForTimeout(400);
  await shot(page, 'crew', p);
});

test('Bangla: the first mission’s briefing, Pack, Launch Day, countdown, coach and flight', async ({ page }, info) => {
  test.setTimeout(120_000);
  const p = info.project.name;
  await banglaPlayer(page, ['cold-open', 'name'], 'VOYA');
  await page.getByRole('button', { name: /^খেলো: মিশন/ }).click();
  await expect(page.getByRole('dialog', { name: 'Mission briefing' })).toBeVisible();
  await page.waitForTimeout(500);
  await shot(page, 'briefing', p);
  await page.getByRole('button', { name: 'বুঝেছি ▸' }).click();
  await page.waitForTimeout(800);
  await shot(page, 'pack', p);
  // Launch Day, from CHANGE on the launch day line
  await page.getByRole('button', { name: 'বদলাও ▸' }).click();
  await expect(page.getByRole('main', { name: 'উৎক্ষেপণের দিন' })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(500);
  await shot(page, 'launchday', p);
  await page.getByRole('switch', { name: 'আর্ম' }).click();
  await page.getByRole('button', { name: 'উৎক্ষেপণ', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'উৎক্ষেপণ' })).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  await shot(page, 'countdown', p);
  await expect(page.getByRole('dialog', { name: 'কীভাবে ওড়াবে' })).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(500);
  await shot(page, 'coach', p);
  await page.getByRole('button', { name: 'বাদ দাও', exact: true }).click();
  await page.waitForTimeout(500);
  await shot(page, 'fly', p);
  // Fly on to the first card (a danger, or the eclipse plan), then answer it and watch the order cross space.
  const card = page.getByRole('dialog', { name: /^(বিপদের কার্ড|আগাম পরিকল্পনা)/ });
  for (let i = 0; i < 60 && !(await card.isVisible()); i++) {
    const next = page.getByRole('button', { name: 'পরের ঘটনা' });
    if ((await next.isVisible()) && (await next.isEnabled())) await next.click();
    else await page.waitForTimeout(250);
  }
  await expect(card).toBeVisible();
  await page.waitForTimeout(600);
  await shot(page, 'card', p);
  await page.locator('.dc-choice:not([disabled])').first().click();
  await page.waitForTimeout(1500);
  await shot(page, 'order', p);
});
