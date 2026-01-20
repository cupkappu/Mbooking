'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Users,
  Settings,
  Server,
  FileText,
  Download,
  Plug,
  Clock,
  Heart,
  ChevronLeft,
  ChevronRight,
  LogOut,
  DollarSign,
} from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { QueryProvider } from '@/providers/query-provider';
import { SessionProvider } from '@/providers/session-provider';

const adminNavItems = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/currencies', label: 'Currencies', icon: DollarSign },
  { href: '/admin/system', label: 'Settings', icon: Settings },
  { href: '/admin/providers', label: 'Providers', icon: Server },
  { href: '/admin/logs', label: 'Audit Logs', icon: FileText },
  { href: '/admin/export', label: 'Data Export', icon: Download },
  { href: '/admin/plugins', label: 'Plugins', icon: Plug },
  { href: '/admin/scheduler', label: 'Scheduler', icon: Clock },
  { href: '/admin/health', label: 'Health', icon: Heart },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <SessionProvider>
      <QueryProvider>
        <div className="flex h-screen bg-background">
          {/* Sidebar */}
          <aside
            className={cn(
              'flex flex-col border-r bg-card transition-all duration-300',
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

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="container mx-auto py-6 px-6">
              {children}
            </div>
          </main>
        </div>
      </QueryProvider>
    </SessionProvider>
  );
}
