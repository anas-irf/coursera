import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

import { useTheme } from '../theme/ThemeProvider';
import type { ThemePreference } from '../theme/theme';
import { IconButton } from './Button';
import { SegmentedControl } from './SegmentedControl';
import type { SegmentOption } from './SegmentedControl';

/** Light and dark in one click (the top bar). */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <IconButton
      icon={dark ? Sun : Moon}
      label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggle}
      className={className}
    />
  );
}

const OPTIONS: SegmentOption<ThemePreference>[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/** Light, dark or the system's choice (the account settings). */
export function ThemePicker({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  return (
    <SegmentedControl label="Theme" options={OPTIONS} value={preference} onChange={setPreference} className={className} />
  );
}

export default ThemeToggle;
