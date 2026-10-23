import React, { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, Outlet, matchPath, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, LogOut, Menu as MenuIcon, Monitor, Moon, Settings, Sun, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { DemoSwitcher } from '../../features/accounts';
import { NotificationDropdown } from '../../features/notifications';
import { BRAND } from '../../shared/brand';
import { useAuth } from '../../shared/auth/AuthProvider';
import { homePathFor } from '../../shared/auth/paths';
import { cn } from '../../shared/lib/cn';
import { fullName } from '../../shared/lib/names';
import { useTheme } from '../../shared/theme/ThemeProvider';
import Avatar from '../../shared/ui/Avatar';
import { Badge } from '../../shared/ui/Badge';
import { IconButton } from '../../shared/ui/Button';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import { Drawer } from '../../shared/ui/Drawer';
import { Logo } from '../../shared/ui/Logo';
import { Menu, MenuHeader, MenuItem, MenuLabel, MenuSeparator } from '../../shared/ui/Menu';
import { ThemeToggle } from '../../shared/ui/ThemeToggle';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Active only on this exact path (a role's home). */
  end?: boolean;
  /** A count on the right (courses waiting for review); hidden when 0. */
  badge?: number;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

interface AppShellProps {
  /** How the role is called in the account menu ("Student"). */
  roleLabel: string;
  sections: NavSection[];
  /** Where the account settings of the role are. */
  accountPath: string;
  /** The page with all notifications of the role. */
  notificationsPath: string;
  /** Under the navigation (the Plus card of a student). */
  sidebarFooter?: ReactNode;
  /** What the logout confirmation says. */
  logoutMessage?: string;
  /** Something next to the user's name in the account menu (the Plus badge). */
  accountBadge?: ReactNode;
  /** The page; the nested routes by default. */
  children?: ReactNode;
}

const isActive = (item: NavItem, pathname: string): boolean =>
  Boolean(matchPath({ path: item.to, end: Boolean(item.end) }, pathname));

const navLinkClass = ({ isActive: active }: { isActive: boolean }): string =>
  cn(
    'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active ? 'bg-primary-soft text-primary-fg' : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
  );

interface NavigationProps {
  sections: NavSection[];
  onNavigate?: () => void;
}

const Navigation = ({ sections, onNavigate }: NavigationProps) => (
  <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
    {sections.map((section) => (
      <div key={section.title}>
        <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{section.title}</p>
        <ul className="space-y-0.5">
          {section.items.map(({ to, label, icon: Icon, end, badge }) => (
            <li key={to}>
              <NavLink to={to} end={end} className={navLinkClass} onClick={onNavigate}>
                <Icon size={18} aria-hidden="true" className="shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {badge !== undefined && badge > 0 && (
                  <span className="rounded-full bg-danger px-1.5 py-px text-[11px] font-semibold text-white tabular-nums">
                    {badge}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </nav>
);

const SidebarFooterNote = () => <p className="px-5 pb-4 text-[11px] leading-4 text-fg-subtle">{BRAND.disclaimer}</p>;

/**
 * The frame of every signed-in page: the navigation on the left (a drawer on a phone), a top bar
 * with the theme, the notifications and the account menu, and the page in the middle.  The three
 * role layouts are this shell with their own navigation.
 */
export function AppShell({
  roleLabel,
  sections,
  accountPath,
  notificationsPath,
  sidebarFooter,
  logoutMessage = 'You will need to log in again to come back.',
  accountBadge,
  children,
}: AppShellProps) {
  const { pathname } = useLocation();
  const { user, userType, logout } = useAuth();
  const { confirmLogout } = useConfirm();
  const { preference, setPreference } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const name = fullName(user, roleLabel);
  const home = homePathFor(userType);
  const current = sections.flatMap((section) => section.items).find((item) => isActive(item, pathname));

  // a page that is opened by a link (not through the drawer) closes it too
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    if (await confirmLogout(logoutMessage, 'Log out')) await logout();
  };

  const brand = (compact = false) => (
    <Link to={home} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Logo compact={compact} />
    </Link>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-pop"
      >
        Skip to content
      </a>

      {/* the navigation: fixed on a large screen */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">{brand()}</div>
        <Navigation sections={sections} />
        {sidebarFooter && <div className="px-3 pb-3">{sidebarFooter}</div>}
        <SidebarFooterNote />
      </aside>

      {/* ... and a drawer on a smaller one */}
      {drawerOpen && (
        <Drawer label="Navigation" onClose={() => setDrawerOpen(false)}>
          <div className="flex h-16 shrink-0 items-center justify-between px-5">
            {brand()}
            <IconButton icon={X} label="Close navigation" onClick={() => setDrawerOpen(false)} />
          </div>
          <Navigation sections={sections} onNavigate={() => setDrawerOpen(false)} />
          {sidebarFooter && <div className="px-3 pb-3">{sidebarFooter}</div>}
          <SidebarFooterNote />
        </Drawer>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
          <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8">
            <IconButton
              icon={MenuIcon}
              label="Open navigation"
              onClick={() => setDrawerOpen(true)}
              className="-ml-2 lg:hidden"
            />
            <div className="lg:hidden">{brand(true)}</div>

            <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm lg:flex">
              <Link to={home} className="text-fg-subtle transition-colors hover:text-fg">
                {roleLabel}
              </Link>
              {current && current.to !== home && (
                <>
                  <ChevronRight size={14} aria-hidden="true" className="text-fg-subtle" />
                  <span className="truncate font-medium text-fg">{current.label}</span>
                </>
              )}
            </nav>

            <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
              <DemoSwitcher />
              <ThemeToggle className="hidden sm:inline-flex" />
              <NotificationDropdown viewAllPath={notificationsPath} />
              <Menu
                label="Account menu"
                buttonClassName="ml-1 flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:pr-2"
                button={
                  <>
                    <Avatar name={name} className="h-8 w-8 text-xs" />
                    <span className="hidden max-w-[10rem] text-left md:block">
                      <span className="block truncate text-sm font-medium text-fg">{name}</span>
                      <span className="block text-xs text-fg-subtle">{roleLabel}</span>
                    </span>
                    <ChevronDown size={16} aria-hidden="true" className="hidden text-fg-subtle md:block" />
                  </>
                }
              >
                <MenuHeader>
                  <div className="flex items-center gap-3">
                    <Avatar name={name} className="h-10 w-10 text-sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-fg">{name}</p>
                      <p className="truncate text-xs text-fg-subtle">{user ? user.email : ''}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone="primary">{roleLabel}</Badge>
                    {accountBadge}
                  </div>
                </MenuHeader>
                <MenuSeparator />
                <MenuItem icon={Settings} to={accountPath}>
                  Account settings
                </MenuItem>
                <MenuSeparator />
                <MenuLabel>Theme</MenuLabel>
                <MenuItem icon={Sun} checked={preference === 'light'} onSelect={() => setPreference('light')}>
                  Light
                </MenuItem>
                <MenuItem icon={Moon} checked={preference === 'dark'} onSelect={() => setPreference('dark')}>
                  Dark
                </MenuItem>
                <MenuItem icon={Monitor} checked={preference === 'system'} onSelect={() => setPreference('system')}>
                  System
                </MenuItem>
                <MenuSeparator />
                <MenuItem icon={LogOut} tone="danger" onSelect={handleLogout}>
                  Log out
                </MenuItem>
              </Menu>
            </div>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-8">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
