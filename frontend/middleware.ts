import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

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
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/accounts/:path*',
    '/journal/:path*',
    '/reports/:path*',
    '/settings/:path*',
  ],
};
