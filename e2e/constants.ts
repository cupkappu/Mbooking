/**
 * E2E 测试统一凭证常量
 * 所有测试应使用此文件中的凭证
 */

// 测试账户凭证
export const TEST_CREDENTIALS = {
  email: 'admin@test.com',
  password: 'AdminTest123',
};

// 备用管理员账户（用于需要第二个用户的测试）
export const ADMIN_CREDENTIALS = {
  email: 'admin@example.com',
  password: 'password123',
};

// 测试用户默认密码
export const DEFAULT_USER_PASSWORD = 'TestPassword123';

// 等待超时配置
export const TIMEOUTS = {
  short: 1000,
  medium: 3000,
  long: 5000,
  veryLong: 10000,
};

// URL 路径常量
export const PATHS = {
  login: '/login',
  dashboard: '/dashboard',
  accounts: '/accounts',
  journal: '/journal',
  reports: '/reports',
  settings: '/settings',
  budgets: '/budgets',
  balance: '/balance',
  alerts: '/alerts',
};
