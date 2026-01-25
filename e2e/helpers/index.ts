import { Page, expect } from '@playwright/test';
import { TEST_CREDENTIALS, TIMEOUTS } from '../constants';

/**
 * 通用测试辅助函数
 */

/**
 * 登录函数 - 使用统一凭证
 */
export async function login(page: Page, credentials = TEST_CREDENTIALS): Promise<void> {
  await page.goto('/login');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: TIMEOUTS.medium });
  await page.fill('input[type="email"]', credentials.email);
  await page.fill('input[type="password"]', credentials.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: TIMEOUTS.long });
}

/**
 * 等待页面加载完成（智能等待而非硬等待）
 */
export async function waitForLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

/**
 * 等待元素可见（带超时）
 */
export async function waitForVisible(
  page: Page,
  locator: string,
  timeout = TIMEOUTS.medium
): Promise<void> {
  await expect(page.locator(locator)).toBeVisible({ timeout });
}

/**
 * 等待 API 请求完成
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string,
  timeout = TIMEOUTS.long
): Promise<void> {
  const response = await page.waitForResponse(urlPattern, { timeout });
  expect(response.status()).toBeGreaterThanOrEqual(200);
  expect(response.status()).toBeLessThan(300);
}

/**
 * 导航到指定页面并等待加载
 */
export async function navigateTo(
  page: Page,
  path: string
): Promise<void> {
  await page.goto(path);
  await waitForLoad(page);
}

/**
 * 安全获取元素文本（元素不存在时不抛错）
 */
export async function safeGetText(
  page: Page,
  locator: string,
  defaultValue = ''
): Promise<string> {
  const element = page.locator(locator);
  if (await element.isVisible()) {
    return (await element.textContent()) || defaultValue;
  }
  return defaultValue;
}

/**
 * 条件测试跳过辅助函数
 * 使用 test.skip() 而非 catch + return
 */
export function skipIf(
  condition: boolean,
  reason: string
): void {
  if (condition) {
    test.skip(`Condition met: ${reason}`);
  }
}

/**
 * 检查是否有控制台错误
 */
export async function checkConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}

/**
 * 等待页面过渡完成
 */
export async function waitForTransition(page: Page): Promise<void> {
  await page.waitForTimeout(300); // 短过渡动画等待
  await waitForLoad(page);
}
