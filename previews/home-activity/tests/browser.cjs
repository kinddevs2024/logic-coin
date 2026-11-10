const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:8094/';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'], ...(process.env.PREVIEW_URL && process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage(), errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => requests.push({ url: request.url(), method: request.method() }));
  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.card').count(), 3);
    assert.equal(await page.locator('#gamesToggle').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('[data-play="3"]').getAttribute('tabindex'), '-1');
    const collapsed = await page.locator('#gamesViewport').evaluate(element => element.getBoundingClientRect().height);
    assert(Math.abs(collapsed - 202) < 2);
    await page.screenshot({ path: '/workspace/shared/logic-home-preview-desktop.png', fullPage: true });
    await page.locator('#gamesToggle').click(); await page.waitForTimeout(450);
    assert.equal(await page.locator('#gamesToggle').getAttribute('aria-expanded'), 'true');
    assert(await page.locator('#gamesViewport').evaluate(element => element.getBoundingClientRect().height > 470));
    for (const i of [2, 3, 4, 5]) await page.locator(`[data-play="${i}"]`).click();
    assert.equal(await page.locator('#gamesCount').innerText(), '6 / 6'); assert(await page.locator('#dailyComplete').isVisible());
    await page.locator('#gamesToggle').click(); await page.waitForTimeout(450);
    assert.equal(await page.locator('#gamesToggle').getAttribute('aria-expanded'), 'false');

    for (const [name, week, month] of [['week-limit','true','true'], ['week-out','false','true'], ['month-limit','true','true'], ['both-out','false','false'], ['new-week','true','false']]) {
      await page.locator(`[data-scenario="${name}"]`).click();
      assert.equal(await page.locator('#weekCard').getAttribute('data-eligible'), week, name);
      assert.equal(await page.locator('#monthCard').getAttribute('data-eligible'), month, name);
      assert.equal(await page.locator('#weekSelfOrbit').getAttribute('aria-hidden'), String(week === 'false'));
      assert.equal(await page.locator('#monthSelfOrbit').getAttribute('aria-hidden'), String(month === 'false'));
    }
    await page.locator('[data-scenario="week-out"]').click();
    assert.match(await page.locator('#activeFocus').innerText(), /месячный/);
    assert(await page.locator('#weekCta').isVisible());
    await page.locator('#weekCta').click();
    await page.locator('[data-rules="month"]').click();
    assert(await page.locator('#rulesDialog').isVisible()); assert.match(await page.locator('#rulesContent').innerText(), /4 дня/);
    await page.keyboard.press('Escape'); assert(!(await page.locator('#rulesDialog').isVisible()));
    await page.locator('[data-scenario="first-day"]').click();
    assert.equal(await page.locator('#weekCard').getAttribute('data-misses'), '0');
    await page.locator('#nextDay').click(); await page.locator('#nextDay').click();
    assert.equal(await page.locator('#weekCard').getAttribute('data-eligible'), 'true');
    await page.locator('#nextDay').click();
    assert.equal(await page.locator('#weekCard').getAttribute('data-eligible'), 'false');
    assert.equal(await page.locator('#monthCard').getAttribute('data-eligible'), 'true');

    for (const width of [471, 360, 320]) {
      await page.setViewportSize({ width, height: 854 });
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Overflow at ' + width);
    }
    await page.setViewportSize({ width: 471, height: 854 });
    if (!await page.locator('.scenario-details').evaluate(element => element.open)) await page.locator('.scenario-details summary').click();
    await page.locator('[data-scenario="active"]').click();
    await page.locator('.scenario-details summary').click();
    await page.locator('.app-shell').scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
    await page.screenshot({ path: '/workspace/shared/logic-home-preview-mobile.png' });
    await page.locator('#weekCard').scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
    await page.screenshot({ path: '/workspace/shared/logic-home-preview-week.png' });
    await page.locator('#themeToggle').click();
    assert.equal(await page.locator('body').getAttribute('data-theme'), 'light');
    assert.equal(await page.locator('#weekTitle').evaluate(element => getComputedStyle(element).color), 'rgb(22, 41, 54)');
    await page.locator('#weekCard').scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
    await page.screenshot({ path: '/workspace/shared/logic-home-preview-light.png' });
    assert.equal(errors.length, 0, errors.join('\n'));
    assert.equal(requests.some(request => request.method !== 'GET' || new URL(request.url).pathname.startsWith('/api/')), false);
    const report = { passed: true, url: base, cards: 3, collapseAndExpand: true, allGamesCompletion: true, twoAndFourMissLimits: true, avatarParticipationFollowsEligibility: true, newWeekReset: true, modalKeyboardClose: true, mobileWidths: [471, 360, 320], lightAndDark: true, backendRequests: 0, browserErrors: errors };
    fs.writeFileSync('/workspace/shared/logic-home-preview-browser-check.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
