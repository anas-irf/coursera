/**
 * Light, dark or "whatever the system says": the choice is kept in ``localStorage`` under
 * ``theme`` (public/index.html reads the same key before the first paint) and shown by the
 * ``dark`` class on ``<html>``, which switches the design tokens of src/index.css.
 */
export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system';

/** The saved choice; "system" when nothing (or nothing readable) is saved. */
export function readPreference(): ThemePreference {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(saved) ? saved : 'system';
  } catch (error) {
    return 'system';
  }
}

export function savePreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch (error) {
    // not remembered: the choice still applies to this page
  }
}

/** The media query of the system's dark mode (``null`` where there is none, as in the tests). */
export function darkQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null;
}

export function systemTheme(): ResolvedTheme {
  const query = darkQuery();
  return query && query.matches ? 'dark' : 'light';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference;
}

/** Puts the theme on the page: the class the tokens switch on and the browser's own controls. */
export function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}
