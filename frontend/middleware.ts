import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Setup route - allow unauthenticated access (system not initialized)
    // This prevents redirect loops during initial setup
    if (path.startsWith('/setup')) {
      // If system is already initialized, redirect to dashboard
      // The setup page itself handles this check via API
      return NextResponse.next();
    }

    // Admin route protection - require admin role
    if (path.startsWith('/admin')) {
      if (token?.role !== 'admin') {
        // If not admin, redirect to dashboard (or login if not authenticated)
        if (!token) {
          return NextResponse.redirect(new URL('/login?callbackUrl=' + path, req.url));
        }
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    }

    // Dashboard route protection - require authentication
    // Protect all dashboard routes: /dashboard, /accounts, /journal, /reports, /settings
    if (
      path.startsWith('/dashboard') ||
      path.startsWith('/accounts') ||
      path.startsWith('/journal') ||
      path.startsWith('/reports') ||
      path.startsWith('/settings')
    ) {
      if (!token) {
        return NextResponse.redirect(new URL('/login?callbackUrl=' + path, req.url));
      }
    }
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        // Allow unauthenticated access to setup routes
        if (path.startsWith('/setup')) {
          return true;
        }
        // All other matched routes require authentication
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/setup/:path*',
    '/admin/:path*',
    '/dashboard/:path*',
    '/accounts/:path*',
    '/journal/:path*',
    '/reports/:path*',
    '/settings/:path*',
  ],
};
