'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type RoleName = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'AUDITOR' | 'USER';

interface NavItem {
  href: Route;
  label: string;
  minRole?: RoleName;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard' as Route, label: 'Dashboard' },
  { href: '/my-devices' as Route, label: 'My Devices' },
  { href: '/machines' as Route, label: 'Machines', minRole: 'OPERATOR' },
  { href: '/routes' as Route, label: 'Routes', minRole: 'OPERATOR' },
  { href: '/health' as Route, label: 'Health' },
  { href: '/devices/add' as Route, label: 'Add Device', minRole: 'OPERATOR' },
  { href: '/dns' as Route, label: 'DNS', minRole: 'ADMIN' },
  { href: '/policies' as Route, label: 'Policies', minRole: 'ADMIN' },
  { href: '/api-keys' as Route, label: 'API Keys', minRole: 'OWNER' },
  { href: '/audit' as Route, label: 'Audit', minRole: 'AUDITOR' },
  { href: '/settings' as Route, label: 'Settings', minRole: 'ADMIN' },
];

const ROLE_HIERARCHY: Record<RoleName, number> = {
  OWNER: 100,
  ADMIN: 80,
  OPERATOR: 60,
  AUDITOR: 40,
  USER: 20,
};

function meetsMinimumRole(userRoles: RoleName[], minRole: RoleName): boolean {
  const minLevel = ROLE_HIERARCHY[minRole];
  return userRoles.some((role) => ROLE_HIERARCHY[role] >= minLevel);
}

function getHighestRole(roles: RoleName[]): RoleName | null {
  if (!roles.length) return null;
  return roles.reduce((highest, current) =>
    ROLE_HIERARCHY[current] > ROLE_HIERARCHY[highest] ? current : highest
  );
}

/**
 * Application Header
 *
 * Displays role-based navigation and user authentication status.
 */
export function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const userRoles = (session?.user?.roles ?? []) as RoleName[];
  const highestRole = getHighestRole(userRoles);

  // Filter nav items based on user roles
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (!item.minRole) return true;
    return meetsMinimumRole(userRoles, item.minRole);
  });

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/dashboard" className="mr-6 flex items-center space-x-2">
            <span className="font-bold">TailDeck</span>
          </Link>
          <nav className="hidden items-center space-x-6 text-sm font-medium md:flex">
            {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`transition-colors hover:text-foreground/80 ${
                  pathname === item.href || pathname.startsWith(item.href + '/')
                    ? 'text-foreground'
                    : 'text-foreground/60'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          {status === 'loading' ? (
            <div className="h-8 w-24 animate-pulse rounded bg-muted" />
          ) : session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <span className="hidden text-sm sm:inline">
                    {session.user.name || session.user.email}
                  </span>
                  {highestRole && (
                    <Badge variant="secondary" className="text-xs">
                      {highestRole}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{session.user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session.user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {userRoles.length > 0 && (
                  <>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Roles
                    </DropdownMenuLabel>
                    <div className="flex flex-wrap gap-1 px-2 py-1.5">
                      {userRoles.map((role) => (
                        <Badge key={role} variant="outline" className="text-xs">
                          {role}
                        </Badge>
                      ))}
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="cursor-pointer"
                >
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/api/auth/signin">Sign In</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
