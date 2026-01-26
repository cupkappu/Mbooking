import { TenantMiddleware } from './tenant.middleware';

describe('TenantMiddleware', () => {
  let middleware: TenantMiddleware;
  let dataSource: any;

  beforeEach(() => {
    dataSource = { query: jest.fn() };
    middleware = new TenantMiddleware(dataSource as any);
  });

  test('allows /api/v1/setup when DB is empty', async () => {
    dataSource.query.mockResolvedValue([{ count: '0' }]);
    const req: any = { path: '/api/v1/setup', headers: {} };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn(), redirect: jest.fn() };
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 503 JSON for arbitrary API when DB is empty', async () => {
    dataSource.query.mockResolvedValue([{ count: '0' }]);
    const req: any = { path: '/api/v1/foo', headers: {} };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn(), redirect: jest.fn() };
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'Service not initialized', message: 'System needs setup' });
    expect(next).not.toHaveBeenCalled();
  });

  test('redirects browser navigations to /setup when DB is empty', async () => {
    dataSource.query.mockResolvedValue([{ count: '0' }]);
    const req: any = { path: '/dashboard', headers: { accept: 'text/html' }, method: 'GET' };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn(), redirect: jest.fn() };
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith(302, '/setup');
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 503 JSON for non-navigation requests to pages when DB is empty', async () => {
    dataSource.query.mockResolvedValue([{ count: '0' }]);
    const req: any = { path: '/dashboard', headers: { accept: 'application/json' }, method: 'POST' };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn(), redirect: jest.fn() };
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'Service not initialized', message: 'System needs setup' });
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next when DB has users', async () => {
    dataSource.query.mockResolvedValue([{ count: '1' }]);
    const req: any = { path: '/api/v1/foo', headers: {} };
    const res: any = {};
    const next = jest.fn();

    await middleware.use(req, res as any, next);

    expect(next).toHaveBeenCalled();
  });
});