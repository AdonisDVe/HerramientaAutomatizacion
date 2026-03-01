const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://sirio-dev-frontend-alb-894180136.us-east-1.elb.amazonaws.com/user/login');
  await page.locator('div').first().dblclick();
  await page.locator('div').first().click();
  await page.locator('div').first().click();

  // ---------------------
  await context.close();
  await browser.close();
})();