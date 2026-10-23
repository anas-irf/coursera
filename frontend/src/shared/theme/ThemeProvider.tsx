import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  THEME_STORAGE_KEY, applyTheme, darkQuery, isThemePreference, readPreference, resolveTheme, savePreference,
} from './theme';
import type { ResolvedTheme, ThemePreference } from './theme';

export interface ThemeContextValue {
  /** What the user chose: light, dark or the system's. */
  preference: ThemePreference;
  /** What is shown. */
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Light to dark and back (an explicit choice from then on). */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * The theme of the whole app.  The class on ``<html>`` is changed before the state, so whatever
 * renders next (a chart reading the tokens, say) already sees the new colours.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolveTheme(readPreference()));

  const show = useCallback((next: ThemePreference) => {
    const resolved = resolveTheme(next);
    applyTheme(resolved);
    setPreferenceState(next);
    setTheme(resolved);
  }, []);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      savePreference(next);
      show(next);
    },
    [show]
  );

  const toggle = useCallback(() => setPreference(theme === 'dark' ? 'light' : 'dark'), [theme, setPreference]);

  // the page starts with the class the script of index.html set; this makes sure of it
  useEffect(() => {
    applyTheme(theme);
    // only once: later changes go through show()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "system" follows the operating system while the page is open
  useEffect(() => {
    const query = darkQuery();
    if (preference !== 'system' || !query) return undefined;
    const onChange = () => show('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [preference, show]);

  // a choice made in another tab applies here too
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      show(isThemePreference(event.newValue) ? event.newValue : 'system');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [show]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, theme, setPreference, toggle }),
    [preference, theme, setPreference, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The theme and the ways to change it.  Outside a provider (a component test) it is light and fixed. */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  return context || FIXED_LIGHT;
}

const FIXED_LIGHT: ThemeContextValue = {
  preference: 'light',
  theme: 'light',
  setPreference: () => {},
  toggle: () => {},
};
