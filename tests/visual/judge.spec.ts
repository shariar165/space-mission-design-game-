// The README's "Judge in 3 minutes" route, played on a fresh browser through the judge link (?play=mars), step by
// step, so the route stays true. Desktop only (the route is written for a desktop). Shots in test-results/shots/judge-*.
// Run: npx playwright test judge --project=desktop
import { expect, test, type Page } from '@playwright/test';

const OUT = 'test-results/shots/judge-';
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1000, 'the judge route is a desktop route');

/** First-flight help a new player meets (the launch countdown, the coach): close it the way a judge would. */
async function clearHelp(page: Page) {
  for (let i = 0; i < 6; i++) {
    const skip = page.getByRole('button', { name: /^SKIP/ });
    if (await skip.first().isVisible()) {
      await skip.first().click();
      await page.waitForTimeout(300);
      continue;
    }
    await page.waitForTimeout(300);
  }
}

test('judge route', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/?play=mars&seed=2013');
  // 0:00 Name Your Robot: SKIP
  await page.getByRole('button', { name: /^SKIP/ }).first().click();
  // 0:15 the objective
  const brief = page.getByRole('dialog', { name: 'Mission briefing' });
  await expect(brief).toBeVisible({ timeout: 60_000 });
  await brief.getByRole('radio', { name: /^MAP THE SURFACE/ }).click();
  await brief.getByRole('button', { name: 'GOT IT ▸' }).click();
  // 0:30 the plate, the preview, the camera
  await expect(page.getByText('✗ NOT PACKED')).toBeVisible();
  const camera = page.getByRole('button', { name: 'Pack Camera', exact: true });
  await camera.hover();
  await expect(page.getByText('IF YOU PACK: CAMERA')).toBeVisible();
  await camera.click();
  await expect(page.getByRole('status', { name: 'Mission objective' }).getByText('✓ ON BOARD')).toBeVisible();
  await page.screenshot({ path: `${OUT}1-pack.png` });
  // 0:55 rocket and orbit
  await page.getByRole('tab', { name: 'ROCKET' }).click();
  await page.getByRole('radio', { name: /Atlas V 411/ }).click();
  await expect(page.getByText('+$20M ON THE BUDGET')).toBeVisible();
  await page.getByRole('tab', { name: 'ORBIT' }).click();
  await expect(page.getByRole('radiogroup', { name: 'Science orbit' }).getByRole('radio')).toHaveCount(3);
  await page.screenshot({ path: `${OUT}2-orbit.png` });
  // 1:20 launch, the first danger card, a choice
  await expect(page.getByRole('button', { name: 'CHANGE ▸' })).toBeEnabled({ timeout: 60_000 });
  await page.getByRole('switch', { name: 'Arm' }).click();
  await page.getByRole('button', { name: 'LAUNCH', exact: true }).click();
  await expect(page.getByRole('img', { name: /Map: your robot/ })).toBeVisible({ timeout: 60_000 });
  await clearHelp(page);
  const card = page.getByRole('dialog', { name: /DANGER CARD/ });
  for (let i = 0; i < 80 && !(await card.isVisible()); i++) {
    const next = page.getByRole('button', { name: 'Next event' });
    if ((await next.isVisible()) && (await next.isEnabled())) await next.click();
    else {
      await clearHelp(page);
      await page.waitForTimeout(250);
    }
  }
  await expect(card).toBeVisible();
  await expect(card.getByText(/REAL HISTORY/i)).toBeVisible();
  await page.screenshot({ path: `${OUT}3-card.png` });
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(1500);
  // 1:50 finish and the report
  await page.getByRole('button', { name: /^FINISH MISSION/ }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /FINISH/ }).last().click();
  await page.getByRole('button', { name: 'SEE MISSION REPORT ▸' }).click({ timeout: 120_000 });
  await expect(page.locator('.al-obj')).toBeVisible();
  await page.screenshot({ path: `${OUT}4-report.png` });
  // 2:15 FLY AGAIN: the design kept, the last flight over the bars
  await page.getByRole('button', { name: 'FLY AGAIN' }).first().click();
  await expect(page.getByRole('group', { name: 'Last flight' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Unpack Camera' })).toBeVisible();
  await page.screenshot({ path: `${OUT}5-fly-again.png` });
  // 2:30 Team: Home, TEAM (four players by default), the objective vote, pack, launch, the team's card
  await page.getByRole('button', { name: 'Signal Delay: home' }).first().click();
  await page.getByRole('button', { name: /^TEAM: / }).click();
  await page.getByRole('button', { name: 'NEXT · OBJECTIVE' }).click();
  await page.getByRole('button', { name: /STUDY THE ATMOSPHERE/ }).click();
  for (const r of ['SPACECRAFT ENGINEER', 'SCIENCE LEAD', 'COMMS & OPS']) await page.getByRole('button', { name: `${r}: AGREE` }).click();
  await page.getByRole('button', { name: 'LOCK OBJECTIVE' }).click();
  await page.getByRole('button', { name: 'NEXT · PACK' }).click();
  await expect(page.getByRole('button', { name: 'CHANGE ▸' })).toBeEnabled({ timeout: 60_000 });
  await page.getByRole('switch', { name: 'Arm' }).click();
  await page.getByRole('button', { name: 'LAUNCH', exact: true }).click();
  await expect(page.getByRole('img', { name: /Map: your robot/ })).toBeVisible({ timeout: 60_000 });
  for (let i = 0; i < 80 && !(await card.isVisible()); i++) {
    const next = page.getByRole('button', { name: 'Next event' });
    if ((await next.isVisible()) && (await next.isEnabled())) await next.click();
    else {
      await clearHelp(page);
      await page.waitForTimeout(250);
    }
  }
  await expect(card).toBeVisible();
  await expect(page.getByText(/FINAL CALL/).first()).toBeVisible();
  await page.screenshot({ path: `${OUT}6-team-vote.png` });
  // 2:55 বাংলা
  await page.getByRole('button', { name: /^Language:/ }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}7-bangla.png` });
});
