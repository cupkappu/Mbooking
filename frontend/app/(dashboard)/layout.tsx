'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { QueryProvider } from '@/providers/query-provider';
import { SessionProvider } from '@/providers/session-provider';
import { SessionSync } from '@/components/session-sync';
import { UserMenu } from '@/components/layout/user-menu';

const navigation = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Accounts', href: '/accounts' },
  { name: 'Journal', href: '/journal' },
  { name: 'Reports', href: '/reports' },
  { name: 'Settings', href: '/settings' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <SessionProvider>
      <QueryProvider>
        <SessionSync />
        <div className="min-h-screen flex">
          <aside className="w-64 border-r bg-card">
            <div className="p-6">
              <Link href="/dashboard">
                <h1 className="text-xl font-bold">Accounting</h1>
              </Link>
            </div>
            <nav className="px-4 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'block px-4 py-2 rounded-md text-sm font-medium',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent'
                    )}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div className="flex-1 flex flex-col">
            <header className="h-16 border-b flex items-center justify-end px-8 gap-4">
              <UserMenu />
            </header>
            <main className="flex-1 p-8">{children}</main>
          </div>
        </div>
      </QueryProvider>
    </SessionProvider>
  );
}
