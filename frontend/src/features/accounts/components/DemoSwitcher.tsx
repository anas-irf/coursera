import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, GraduationCap, Presentation, Repeat, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { errorMessage } from '../../../shared/api/errors';
import { useAuth } from '../../../shared/auth/AuthProvider';
import { homePathFor } from '../../../shared/auth/paths';
import type { DemoRole } from '../../../shared/auth/types';
import { useDemoAccounts } from '../../../shared/auth/useDemoAccounts';
import { Spinner } from '../../../shared/ui/Spinner';
import { Menu, MenuHeader, MenuItem, MenuSeparator } from '../../../shared/ui/Menu';
import { useToast } from '../../../shared/ui/Toast';

export const DEMO_ROLES: Record<DemoRole, { label: string; icon: LucideIcon }> = {
  student: { label: 'Student', icon: GraduationCap },
  instructor: { label: 'Instructor', icon: Presentation },
  admin: { label: 'Admin', icon: ShieldCheck },
};

/**
 * In the demo, the seeded accounts can switch to the other roles in one click (no logout, no
 * password).  Anyone else, and any server that is not in demo mode, sees nothing.
 */
const DemoSwitcher = () => {
  const { user, loginAsDemo } = useAuth();
  const demo = useDemoAccounts();
  const navigate = useNavigate();
  const toast = useToast();
  const [switching, setSwitching] = useState<DemoRole | null>(null);

  const mine = user ? demo.accounts.find((account) => account.email === user.email) : undefined;
  if (!demo.enabled || !mine) return null;

  const switchTo = async (role: DemoRole) => {
    if (role === mine.role || switching) return;
    setSwitching(role);
    try {
      await loginAsDemo(role);
      navigate(homePathFor(role), { replace: true });
    } catch (error) {
      toast.error(errorMessage(error, 'The demo account could not be opened.'), 'Switch failed');
    } finally {
      setSwitching(null);
    }
  };

  const current = DEMO_ROLES[mine.role];

  return (
    <Menu
      label="Switch demo role"
      buttonClassName="mr-1 inline-flex h-9 items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft px-3 text-xs font-semibold text-primary-fg transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      button={
        <>
          {switching ? <Spinner size={14} label={null} /> : <Repeat size={14} aria-hidden="true" />}
          <span className="hidden sm:inline">Demo: {current.label}</span>
          <ChevronDown size={14} aria-hidden="true" className="hidden sm:block" />
        </>
      }
    >
      <MenuHeader>
        <p className="text-sm font-semibold text-fg">Explore the demo</p>
        <p className="mt-0.5 text-xs text-fg-subtle">Switch to another role; the data is shared by every visitor.</p>
      </MenuHeader>
      <MenuSeparator />
      {demo.accounts.map((account) => {
        const role = DEMO_ROLES[account.role];
        return (
          <MenuItem
            key={account.role}
            icon={role.icon}
            checked={account.role === mine.role}
            onSelect={() => switchTo(account.role)}
          >
            {role.label}
            <span className="block text-xs text-fg-subtle">{account.name}</span>
          </MenuItem>
        );
      })}
    </Menu>
  );
};

export default DemoSwitcher;
