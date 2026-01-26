import { Injectable, NestMiddleware, Redirect } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { TenantContext } from '../context/tenant.context';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private dataSource: DataSource) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Use originalUrl since req.path might be modified by middleware chain
    const originalUrl = req.originalUrl || '';
    const pathStr = req.path || '';

    console.log(`[TenantMiddleware] originalUrl: "${originalUrl}", path: "${pathStr}"`);

    // Check both originalUrl (with prefix) and path (without prefix)
    // The global prefix 'api/v1' is stripped for 'path', so we check both
    const alwaysAllowedPaths = [
      '/setup',
      '/api/v1/setup',
      '/health',
      '/api/v1/health',
      '/auth/login',
      '/api/v1/auth/login',
      '/auth/register',
      '/api/v1/auth/register',
    ];

    const isAlwaysAllowed = alwaysAllowedPaths.some(path =>
      originalUrl === path || originalUrl.startsWith(path + '/') ||
      pathStr === path || pathStr.startsWith(path + '/')
    );

    console.log(`[TenantMiddleware] isAlwaysAllowed: ${isAlwaysAllowed}, originalUrl: "${originalUrl}"`);

    if (isAlwaysAllowed) {
      console.log(`[TenantMiddleware] Allowing through: ${originalUrl}`);
      return next();
    }

    // Check if database is empty (no users) - redirect to setup
    const userCount = await this.dataSource.query('SELECT COUNT(*) FROM users');
    const count = parseInt(userCount[0]?.count || '0', 10);

    if (count === 0) {
      // Database not initialized
      const isSetupPage = pathStr.startsWith('/setup') || pathStr.startsWith('/api/v1/setup');
      const isAuthPage = pathStr.startsWith('/login') || pathStr.startsWith('/api/v1/auth');

      // API requests should get a JSON error (503) so API consumers can handle it.
      // Browser page requests should still be redirected to the setup UI.
      const isApiRequest = pathStr.startsWith('/api/');

      if (isApiRequest) {
        // For API requests, only the alwaysAllowedPaths are permitted
        // Other API endpoints get 503
        res.status(503).json({ error: 'Service not initialized', message: 'System needs setup' });
        return;
      }

      // Non-API requests: only redirect browser navigations to /setup.
      // This avoids redirect loops from server-side fetches or XHR/fetch requests.
      const acceptHeader = (req.headers['accept'] as string) || '';
      const isBrowserNavigation = req.method === 'GET' && acceptHeader.includes('text/html');

      if (!isSetupPage && !isAuthPage) {
        if (isBrowserNavigation) {
          return res.redirect(302, '/setup');
        }
        // Non-navigation requests (e.g., XHR/fetch) should get a 503 JSON instead of a redirect
        res.status(503).json({ error: 'Service not initialized', message: 'System needs setup' });
        return;
      }

      return next();
    }

    // Database is initialized - proceed with normal tenant handling
    // Extract tenant_id directly from JWT token (middleware runs before JwtAuthGuard)
    const authHeader = req.headers.authorization;
    let tenantId: string | undefined;
    let userId: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        // Decode JWT without verification to get tenant_id claim
        // The actual verification is done by JwtAuthGuard later
        const decoded = jwt.decode(token) as { tenant_id?: string; sub?: string; tenantId?: string } | null;
        tenantId = decoded?.tenant_id || decoded?.tenantId;
        userId = decoded?.sub;
      } catch {
        // Invalid token - let JwtAuthGuard handle it
      }
    }

    const requestId = this.getRequestId(req);

    if (!tenantId) {
      // For routes that require tenant context, this will fail later
      // when TenantContext.requireTenantId() is called
      return next();
    }

    TenantContext.run({ tenantId, userId, requestId }, () => {
      next();
    });
  }

  private getRequestId(req: Request): string {
    return (req.headers['x-request-id'] as string) ||
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
