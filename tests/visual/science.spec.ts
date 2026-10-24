// Game shots of Science Targets with the Mars globe as the hero (spec: UI rules 39–43), at the project's size, in
// 3D and with the flat globe. Four states: the arrival landing on the large globe, a surface target (the ring dipping
// with its drag label), Phobos (the orbit change), and an OBSERVE order landing (the scan flash, then IMAGE QUEUED).
// The 3D run then follows the pictures home through the DOWNLINK drawer to the Mission Album.
// Run: npm run shots -- science
import { expect, test, type Page } from '@playwright/test';
import { launchFlight, toMarsOrbit } from './helpers';

const OUT = 'test-results/shots/';

// Let the browser draw with the GPU (headless Chromium otherwise renders WebGL in software, too slowly for the 3D
// globe at 1440 × 900, and the globe rightly falls back to the flat one).
test.use({ launchOptions: { args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] } });

/** Pick a target from the list (on the phone: open the sheet, pick, and let it fall back to its peek). */
async function pick(page: Page, mobile: boolean, name: string) {
  if (mobile) {
    const handle = page.getByRole('button', { name: 'Science targets' });
    await handle.click();
    await page.locator('.sci-card', { hasText: name }).first().click();
    await handle.click();
    await handle.click();
  } else await page.locator('.sci-card', { hasText: name }).first().click();
}

for (const globe of ['3d', '2d'] as const) {
  test(`science targets: the hero globe (${globe})`, async ({ page }, info) => {
    test.setTimeout(240_000);
    const mobile = info.project.name === 'mobile';
    const p = `${info.project.name}${globe === '2d' ? '-2d' : ''}`;
    if (globe === '2d') await page.addInitScript(() => localStorage.setItem('sd.globe', JSON.stringify({ mode: '2d' })));
    await launchFlight(page, mobile);
    await toMarsOrbit(page);

    // 1. The arrival: the map has zoomed into Mars and the globe is fading in; then it has landed on the large globe.
    await page.waitForTimeout(950);
    await page.screenshot({ path: `${OUT}sci-1-arrival-mid-${p}.png` });
    await page.waitForFunction(() => !document.querySelector('.fly.zooming'));
    await page.screenshot({ path: `${OUT}sci-1-arrival-${p}.png` });
    await page.waitForTimeout(2500);
    const fps = await page.evaluate(() => (document.querySelector('[data-globe="3d"]') as HTMLElement | null)?.dataset.fps ?? null);
    console.log(`globe ${p}: ${fps === null ? '2D' : `3D at ${fps} fps`}`);
    if (globe === '3d') expect(fps).not.toBeNull();

    // 2. A surface target: the camera has eased to it, the ring dips to the lower periapsis, the drag label.
    await pick(page, mobile, 'OLYMPUS MONS');
    await page.waitForTimeout(1300);
    await expect(page.locator('.sci-globe')).toHaveAttribute('data-focus', 'olympus-mons');
    await expect(page.locator('.sci-lbl.peri')).toBeVisible();
    await page.screenshot({ path: `${OUT}sci-2-surface-${p}.png` });
    await pick(page, mobile, 'THIN AIR AT THE LIMB');
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `${OUT}sci-2-limb-${p}.png` });

    // 3. Phobos: the orbit change out to the moon and back.
    await pick(page, mobile, 'PHOBOS');
    await page.waitForTimeout(1300);
    await expect(page.locator('.sci-lbl.apo')).toBeVisible();
    await page.screenshot({ path: `${OUT}sci-3-phobos-${p}.png` });

    // 4. OBSERVE: the order crosses space, the orbiter sweeps over the target with the scan flash, then the robot's
    //    reply comes back: IMAGE QUEUED in TRANSMISSIONS.
    await pick(page, mobile, 'VALLES MARINERIS');
    await page.waitForTimeout(1000);
    await page.locator('.sci-observe').click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}sci-4-order-out-${p}.png` });
    await page.locator('.sci-globe[data-flyover]').waitFor({ timeout: 30_000 });
    await page.waitForTimeout(650);
    await page.screenshot({ path: `${OUT}sci-4-order-lands-${p}.png` });
    await page.getByText(/IMAGE QUEUED/).first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}sci-4-image-queued-${p}.png` });
    if (globe === '2d') return;

    // Two more pictures, as the design's DOWNLINK state has, then fly on until every picture is home.
    for (const name of ['PHOBOS', 'OLYMPUS MONS']) {
      await pick(page, mobile, name);
      const observe = page.locator('.sci-observe');
      if (await observe.isEnabled()) await observe.click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: `${OUT}fly-science-ordered-${p}.png` });
    await page.locator('.sci-done').click();
    await page.getByRole('button', { name: /DOWNLINK/ }).first().click();
    const drawer = page.getByRole('region', { name: 'DOWNLINK' });
    await expect(drawer).toBeVisible();
    for (let i = 0; i < 80 && !(await drawer.getByText('ALL IMAGES HOME').count()); i++) {
      const cont = page.getByRole('button', { name: /CONTINUE ▸|^LET THE ROBOT DECIDE/ });
      if (await cont.first().isVisible()) await cont.first().click();
      await page.keyboard.press('n');
      await page.waitForTimeout(300);
    }
    await expect(drawer.getByText('ALL IMAGES HOME')).toBeVisible();
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}fly-downlink-printing-${p}.png` });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${OUT}fly-downlink-${p}.png` });
    // Finish the mission: the report opens with the album (design screen 03).
    await drawer.getByRole('button', { name: /CLOSE/ }).click();
    await page.getByRole('button', { name: 'FINISH MISSION ▸▸' }).first().click();
    await page.getByRole('dialog', { name: 'FINISH THE MISSION?' }).getByRole('button', { name: 'FINISH MISSION ▸▸' }).click();
    await page.getByRole('button', { name: 'SEE MISSION REPORT ▸' }).click();
    await expect(page.getByRole('region', { name: 'Mission album' })).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}report-album-${p}.png` });
  });
}
