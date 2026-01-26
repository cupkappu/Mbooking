'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Users,
  Settings,
  Server,
  FileText,
  Plug,
  Clock,
  Heart,
  ChevronLeft,
  ChevronRight,
  LogOut,
  DollarSign,
  Activity,
  Menu,
} from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { QueryProvider } from '@/providers/query-provider';
import { SessionProvider } from '@/providers/session-provider';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: Activity },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/currencies', label: 'Currencies', icon: DollarSign },
  { href: '/admin/system', label: 'Settings', icon: Settings },
  { href: '/admin/providers', label: 'Providers', icon: Server },
  { href: '/admin/logs', label: 'Audit Logs', icon: FileText },
  { href: '/admin/plugins', label: 'Plugins', icon: Plug },
  { href: '/admin/scheduler', label: 'Scheduler', icon: Clock },
  { href: '/admin/health', label: 'Health', icon: Heart },
];

function MobileAdminNav({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    setOpen(false);
    await signOut({ callbackUrl: '/login' });
  };

  const handleNavigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="p-2 hover:bg-accent rounded-md" data-testid="admin-mobile-menu">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>Admin Panel</SheetTitle>
        </SheetHeader>
        <nav className="mt-6 px-2">
          <ul className="space-y-1">
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <button
                    onClick={() => handleNavigate(item.href)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors w-full text-left',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t mt-6 pt-4">
            <button
              onClick={handleSignOut}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function DesktopSidebar({ pathname, collapsed, setCollapsed }: {
  pathname: string;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
}) {
  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed && (
          <h1 className="text-lg font-semibold">Admin Panel</h1>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 hover:bg-accent rounded"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {adminNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t p-2">
        <button
          onClick={handleSignOut}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SessionProvider>
      <QueryProvider>
        <div className="flex h-screen bg-background">
          <MobileAdminNav pathname={pathname} />
          <DesktopSidebar pathname={pathname} collapsed={collapsed} setCollapsed={setCollapsed} />

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="container mx-auto py-6 px-4 md:px-6">
              {children}
            </div>
          </main>
        </div>
      </QueryProvider>
    </SessionProvider>
  );
}
