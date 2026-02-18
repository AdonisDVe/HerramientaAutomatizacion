import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://sirio-dev-frontend-alb-894180136.us-east-1.elb.amazonaws.com/user/login');
});