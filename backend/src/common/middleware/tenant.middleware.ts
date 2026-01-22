import { Injectable, NestMiddleware, Redirect } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { TenantContext } from '../context/tenant.context';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private dataSource: DataSource) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if database is empty (no users) - redirect to setup
    const userCount = await this.dataSource.query('SELECT COUNT(*) FROM users');
    const count = parseInt(userCount[0]?.count || '0', 10);

    if (count === 0) {
      // Database not initialized - redirect to setup page
      const isSetupPage = req.path.startsWith('/setup') || req.path.startsWith('/api/v1/setup');
      const isAuthPage = req.path.startsWith('/login') || req.path.startsWith('/api/v1/auth');

      if (!isSetupPage && !isAuthPage) {
        // Redirect non-setup, non-auth requests to setup page
        return res.redirect(302, '/setup');
      }
      // Allow access to setup and auth pages
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

    TenantContext.run({ tenantId, userId, requestId }, async () => {
      await this.setPostgresContext();
      next();
    });
  }

  private async setPostgresContext(): Promise<void> {
    const tenantId = TenantContext.tenantId;
    if (tenantId) {
      await this.dataSource.query(
        `SELECT set_config('app.current_tenant_id', $1, false)`,
        [tenantId]
      );
    }
  }

  private getRequestId(req: Request): string {
    return (req.headers['x-request-id'] as string) ||
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
