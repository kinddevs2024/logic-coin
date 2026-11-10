const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:8094/';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'], ...(process.env.PREVIEW_URL && process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage(), errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push({ url: request.url(), method: request.method() }));
  const progress = kind => page.locator(`#${kind}SelfScore`).evaluate(element => Number(element.getAttribute('aria-valuenow')));
  const waterBox = kind => page.locator(`#${kind}Profile .profile-water`).evaluate(element => {
    const box = element.getBoundingClientRect();
    return { top: box.top - element.parentElement.getBoundingClientRect().top, height: box.height };
  });
  const choose = name => page.locator(`[data-scenario="${name}"]`).click();
  const yOffset = selector => page.locator(selector).evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m42);
  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.card').count(), 3);
    assert.equal(await page.locator('.card-heading .heading-clock').count(), 3);
    assert.equal(await page.locator('.status-pill,.activity-facts,.day-progress,.card-note,.period-clock,.games-fade').count(), 0);
    assert.equal(await page.locator('.scenario-details').evaluate(element => element.open), false);
    assert.equal(await page.locator('#gamesToggle').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('[data-play="3"]').getAttribute('tabindex'), '-1');
    const collapsed = await page.locator('#gamesViewport').evaluate(element => element.getBoundingClientRect().height);
    assert(Math.abs(collapsed - 202) < 2);
    assert.notEqual(await page.locator('#gamesViewport').evaluate(element => getComputedStyle(element).maskImage), 'none', 'Collapsed games need a fade into transparency');
    await page.screenshot({ path: '/workspace/shared/logic-home-preview-desktop.png', fullPage: true });

    await page.locator('.scenario-details summary').click();
    await choose('first-day');
    await page.waitForTimeout(950);
    assert.equal(await progress('week'), 0);
    assert(await page.locator('#weekProfile .profile-water').evaluate(element => {
      const style = getComputedStyle(element);
      return Number(style.opacity) === 0 || style.visibility === 'hidden' || element.getBoundingClientRect().height === 0;
    }), 'An empty profile must not show water');
    const before = { week: await progress('week'), month: await progress('month') };
    const waterBefore = await waterBox('week');
    await page.locator('#gamesToggle').click(); await page.waitForTimeout(450);
    assert.equal(await page.locator('#gamesToggle').getAttribute('aria-expanded'), 'true');
    assert(await page.locator('#gamesViewport').evaluate(element => element.getBoundingClientRect().height > 470));
    for (const i of [2, 3, 4]) await page.locator(`[data-play="${i}"]`).click();
    assert.equal(await progress('week'), before.week, 'Five games do not complete an active day');
    await page.locator('[data-play="5"]').click();
    await page.waitForTimeout(1000);
    for (const kind of ['week', 'month']) {
      assert(await progress(kind) > before[kind], `${kind} progress must increase after all six games`);
      assert.match(await page.locator(`#${kind}SelfScore`).innerText(), /^\d+%$/);
    }
    const waterAfter = await waterBox('week');
    assert(waterAfter.top < waterBefore.top || waterAfter.height > waterBefore.height, 'Completing the day raises the water level');
    assert(await page.locator('#weekProfile .profile-water').evaluate(element => Number(getComputedStyle(element).opacity) > 0));
    const waveBefore = await page.locator('#weekProfile .water-wave-front').evaluate(element => getComputedStyle(element).transform);
    await page.waitForTimeout(250);
    assert.notEqual(await page.locator('#weekProfile .water-wave-front').evaluate(element => getComputedStyle(element).transform), waveBefore, 'The water surface continues moving at a fixed fill level');
    await page.locator('#gamesToggle').click(); await page.waitForTimeout(450);
    assert.equal(await page.locator('#gamesToggle').getAttribute('aria-expanded'), 'false');

    for (const [name, week, month] of [['week-limit', 'true', 'true'], ['week-out', 'false', 'true'], ['month-limit', 'true', 'true'], ['both-out', 'false', 'false'], ['new-week', 'true', 'false']]) {
      await choose(name);
      for (const [kind, eligible] of [['week', week], ['month', month]]) {
        assert.equal(await page.locator(`#${kind}Card`).getAttribute('data-eligible'), eligible, name);
        assert.equal(await page.locator(`#${kind}Reel .raffle-group:first-child [data-self]`).count(), Number(eligible === 'true'), name + ' self participation');
        assert.equal(await page.locator(`#${kind}Profile`).isVisible(), true, 'Your profile stays visible after exclusion');
      }
    }
    await choose('week-out');
    await page.locator('[data-rules="month"]').click();
    assert(await page.locator('#rulesDialog').isVisible()); assert.match(await page.locator('#rulesContent').innerText(), /4 дня/);
    await page.keyboard.press('Escape'); assert(!(await page.locator('#rulesDialog').isVisible()));
    await choose('first-day');
    assert.equal(await page.locator('#weekCard').getAttribute('data-misses'), '0');
    await page.locator('#nextDay').click(); await page.locator('#nextDay').click();
    assert.equal(await page.locator('#weekCard').getAttribute('data-eligible'), 'true');
    await page.locator('#nextDay').click();
    assert.equal(await page.locator('#weekCard').getAttribute('data-eligible'), 'false');
    assert.equal(await page.locator('#monthCard').getAttribute('data-eligible'), 'true');
    await choose('new-week');
    assert.equal(await page.locator('#weekCard').getAttribute('data-misses'), '0');
    assert.equal(await progress('week'), 0);

    await choose('active');
    for (const kind of ['week', 'month']) {
      assert.equal(await page.locator(`#${kind}Card .raffle-track`).count(), 1);
      const groups = await page.locator(`#${kind}Reel .raffle-group`).evaluateAll(elements => elements.map(element => ({ height: element.getBoundingClientRect().height, text: element.innerText })));
      assert.equal(groups.length, 2);
      assert.equal(groups[0].text, groups[1].text, 'The loop should repeat the same participants');
      assert(Math.abs(groups[0].height - groups[1].height) < 0.5, 'Loop groups must have equal height');
      assert.notEqual(await page.locator(`#${kind}Card .raffle-window`).evaluate(element => getComputedStyle(element).maskImage), 'none', 'The reel needs soft top and bottom edges');
    }
    const startY = await yOffset('#weekReel');
    await page.waitForTimeout(200); const nextY = await yOffset('#weekReel');
    await page.waitForTimeout(200); const endY = await yOffset('#weekReel');
    assert(nextY < startY && endY < nextY, 'Participants move upward');
    assert(Math.abs((nextY - startY) - (endY - nextY)) < 3, 'The reel should move at a steady speed');

    for (const width of [471, 360, 320]) {
      await page.setViewportSize({ width, height: 854 });
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Overflow at ' + width);
      const overlaps = await page.locator('.card-heading').evaluateAll(elements => elements.map(element => {
        const title = element.firstElementChild.getBoundingClientRect(), clock = element.querySelector('.heading-clock').getBoundingClientRect();
        return title.right > clock.left + 0.5 && title.bottom > clock.top + 0.5;
      }));
      assert(overlaps.every(overlap => !overlap), 'Title and countdown overlap at ' + width);
    }
    await page.setViewportSize({ width: 471, height: 854 });
    await page.locator('.scenario-details summary').click();
    await page.locator('.app-shell').scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
    await page.screenshot({ path: '/workspace/shared/logic-home-preview-mobile.png', fullPage: true });
    await page.locator('#weekCard').scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
    await page.screenshot({ path: '/workspace/shared/logic-home-preview-week.png' });
    await page.locator('#themeToggle').click();
    assert.equal(await page.locator('body').getAttribute('data-theme'), 'light');
    assert.equal(await page.locator('#weekTitle').evaluate(element => getComputedStyle(element).color), 'rgb(22, 41, 54)');
    await page.locator('#weekCard').scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
    await page.screenshot({ path: '/workspace/shared/logic-home-preview-light.png', fullPage: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert(await page.locator('.raffle-track,.water-wave').evaluateAll(elements => elements.every(element => getComputedStyle(element).animationName === 'none')), 'Reduced motion disables continuous animation');
    const stillY = await yOffset('#weekReel'); await page.waitForTimeout(150);
    assert.equal(await yOffset('#weekReel'), stillY);
    assert.equal(errors.length, 0, errors.join('\n'));
    assert.equal(requests.some(request => request.method !== 'GET' || new URL(request.url).pathname.startsWith('/api/')), false);
    const report = { passed: true, url: base, cards: 3, simpleHeaderTimers: true, collapseAndExpand: true, allGamesCompletion: true, percentageAndWaterProgress: true, continuousVerticalReels: true, reducedMotion: true, twoAndFourMissLimits: true, selfParticipationFollowsEligibility: true, newWeekReset: true, modalKeyboardClose: true, mobileWidths: [471, 360, 320], lightAndDark: true, backendRequests: 0, browserErrors: errors };
    fs.writeFileSync('/workspace/shared/logic-home-preview-browser-check.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
