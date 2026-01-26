'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { QueryProvider } from '@/providers/query-provider';
import { SessionSync } from '@/components/session-sync';
import { UserMenu } from '@/components/layout/user-menu';
import { Shield, Menu } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Accounts', href: '/accounts' },
  { name: 'Journal', href: '/journal' },
  { name: 'Reports', href: '/reports' },
  { name: 'Settings', href: '/settings' },
];

function MobileNav({ isAdmin, pathname }: { isAdmin: boolean; pathname: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild className="md:hidden">
        <button className="p-2 hover:bg-accent rounded-md" data-testid="mobile-menu">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle asChild>
            <Link href="/dashboard" onClick={() => setOpen(false)}>
              Accounting
            </Link>
          </SheetTitle>
        </SheetHeader>
        <nav className="mt-6 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setOpen(false)}
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
          {isAdmin && (
            <>
              <div className="pt-4 pb-2">
                <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Administration
                </p>
              </div>
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className={cn(
                  'block px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2',
                  pathname.startsWith('/admin')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent'
                )}
              >
                <Shield className="h-4 w-4" />
                Admin Panel
              </Link>
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function DesktopSidebar({ isAdmin, pathname }: { isAdmin: boolean; pathname: string }) {
  return (
    <aside className="hidden md:flex w-64 border-r bg-card flex-col">
      <div className="p-6">
        <Link href="/dashboard">
          <h1 className="text-xl font-bold">Accounting</h1>
        </Link>
      </div>
      <nav className="px-4 space-y-1 flex-1">
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
        {isAdmin && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Administration
              </p>
            </div>
            <Link
              href="/admin"
              className={cn(
                'block px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2',
                pathname.startsWith('/admin')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              )}
            >
              <Shield className="h-4 w-4" />
              Admin Panel
            </Link>
          </>
        )}
      </nav>
    </aside>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'admin';

  return (
    <QueryProvider>
      <SessionSync />
      <div className="min-h-screen flex">
        <MobileNav isAdmin={isAdmin} pathname={pathname} />
        <DesktopSidebar isAdmin={isAdmin} pathname={pathname} />

        <div className="flex-1 flex flex-col flex-1">
          <header className="h-16 border-b flex items-center justify-end px-4 gap-4 md:px-8">
            <UserMenu />
          </header>
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </QueryProvider>
  );
}
