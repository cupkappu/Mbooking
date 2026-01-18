'use client';

import { useState, useEffect } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';

export interface HeaderProps {
  isAuthenticated: boolean;
  userName?: string | null;
}

export function Header({ isAuthenticated: initialAuth, userName: initialName }: HeaderProps) {
  const { data: session } = useSession();
  const [isAuthenticated, setIsAuthenticated] = useState(initialAuth);
  const [userName, setUserName] = useState(initialName);

  useEffect(() => {
    setIsAuthenticated(!!session);
    setUserName(session?.user?.name || null);
  }, [session]);

  const initials = userName
    ? userName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : '?';

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold flex items-center gap-2">
          <span>Accounting</span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="#features"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Features
          </Link>
          <Link
            href="#pricing"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Pricing
          </Link>
        </nav>

        {/* Auth Actions */}
        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="default">Console</Button>
            </Link>
            <UserMenu userName={userName} />
          </div>
        ) : (
          <Link href="/login">
            <Button variant="default">Sign In</Button>
          </Link>
        )}
      </div>
    </header>
  );
}

function UserMenu({ userName }: { userName?: string | null }) {
  const initials = userName
    ? userName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : '?';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => window.location.href = '/dashboard'}>
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/' })}>
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
