const { chromium } = require('playwright-core');

const appUrl = process.env.APP_URL || 'http://localhost:5173/';
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runScenario(page, mode) {
  const log = [];
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  log.push(`${mode}: app opened`);

  await page.click('button:has-text("다음")');
  await page.waitForSelector('text=현재 위치를 입력해주세요.');
  log.push(`${mode}: validation shown`);

  await page.fill('#currentLocation', '서울 성동구 성수동');
  await page.fill('#nextScheduleLocation', '잠실역');
  await page.fill('#nextScheduleTime', '18:00');
  await page.click('button:has-text("4시간")');
  await page.click('button[aria-label="인원수 증가"]');
  await page.click('button[aria-label="인원수 감소"]');
  await page.click('button:has-text("차량")');
  await page.click('button:has-text("도보")');
  log.push(`${mode}: inputs and selectors changed`);

  await page.click('button:has-text("다음")');
  await page.waitForURL('**/preference');
  await page.waitForSelector('text=취향을 알려주세요');
  log.push(`${mode}: moved to preference`);

  await page.click('button:has-text("좋아요")');
  await page.click('button:has-text("싫어요")');
  await page.click('button:has-text("Skip")');

  const card = page.locator('.swipe-card');
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();

  await page.click('button:has-text("좋아요")');
  await page.click('button:has-text("싫어요")');
  try {
    await page.waitForSelector('text=대안 코스', { timeout: 8000 });
  } catch (_error) {
    if (await page.locator('button:has-text("좋아요")').isVisible()) {
      await page.click('button:has-text("좋아요")');
    }
    await page.waitForSelector('text=대안 코스');
  }
  await page.waitForURL('**/result');
  log.push(`${mode}: preference buttons and swipe gesture completed`);

  const summaryText = await page.locator('.summary-panel').innerText();
  if (!summaryText.includes('총 소요시간') || !summaryText.includes('남은 여유')) {
    throw new Error(`${mode}: summary content missing`);
  }
  log.push(`${mode}: result summary visible`);

  await page.click('.alternative-card button');
  await page.waitForSelector('.alternative-card.is-selected');
  log.push(`${mode}: alternative course selected`);

  await page.click('button:has-text("다시 추천받기")');
  await page.waitForSelector('text=대안 코스');
  log.push(`${mode}: retry recommendation clicked`);

  await page.click('button:has-text("조건 수정하기")');
  await page.waitForURL('**/');
  await page.waitForSelector('#currentLocation');
  const retained = await page.inputValue('#currentLocation');
  if (!retained.includes('서울 성동구')) {
    throw new Error(`${mode}: input state was not retained`);
  }
  log.push(`${mode}: edit conditions retained input state`);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#currentLocation');
  log.push(`${mode}: reload did not crash`);

  return log;
}

async function runErrorScenario(page) {
  const log = [];
  await page.route('**/api/recommendation', (route) => route.abort());
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.fill('#currentLocation', '서울 성동구 성수동');
  await page.fill('#nextScheduleLocation', '잠실역');
  await page.fill('#nextScheduleTime', '18:00');
  await page.click('button:has-text("다음")');

  for (const label of ['좋아요', '싫어요', 'Skip', '좋아요', '좋아요', '싫어요']) {
    await page.click(`button:has-text("${label}")`);
  }

  await page.waitForSelector('text=추천 코스를 불러오지 못했어요.');
  log.push('api-error: error state visible');
  await page.click('button:has-text("다시 시도")');
  await page.waitForSelector('text=추천 코스를 불러오지 못했어요.');
  log.push('api-error: retry button handled failed request');
  await page.unroute('**/api/recommendation');
  return log;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
  });

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const desktopLog = await runScenario(desktop, 'desktop-1440');
  await desktop.close();

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobileLog = await runScenario(mobile, 'mobile-390');
  const hasHorizontalScroll = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (hasHorizontalScroll) {
    throw new Error('mobile-390: horizontal scroll detected');
  }
  mobileLog.push('mobile-390: no horizontal scroll');
  await mobile.close();

  const errorPage = await browser.newPage({ viewport: { width: 768, height: 900 } });
  const errorLog = await runErrorScenario(errorPage);
  await errorPage.close();

  await browser.close();
  console.log([...desktopLog, ...mobileLog, ...errorLog].join('\n'));
})().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
