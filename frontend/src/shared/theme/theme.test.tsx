import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { ThemePicker, ThemeToggle } from '../ui/ThemeToggle';
import { ChartLegend, ChartTooltip, axisProps, useChartTheme } from '../ui/charts';
import { THEME_STORAGE_KEY, readPreference, resolveTheme } from './theme';
import { ThemeProvider, useTheme } from './ThemeProvider';

// what the operating system prefers, changeable by a test
let systemDark = false;
const listeners = new Set<() => void>();

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      get matches() {
        return query.includes('dark') && systemDark;
      },
      media: query,
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    }),
  });
});

afterAll(() => {
  // jsdom has no matchMedia: leave it as the other tests know it
  delete (window as Partial<Window>).matchMedia;
});

beforeEach(() => {
  systemDark = false;
  listeners.clear();
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
});

const Shown = () => {
  const { preference, theme } = useTheme();
  return <p>{`${preference} ${theme}`}</p>;
};

const renderTheme = () =>
  render(
    <ThemeProvider>
      <Shown />
      <ThemeToggle />
      <ThemePicker />
    </ThemeProvider>
  );

test('without a choice the system decides, and the page follows it while it is open', () => {
  systemDark = true;
  renderTheme();

  expect(screen.getByText('system dark')).toBeInTheDocument();
  expect(document.documentElement).toHaveClass('dark');

  systemDark = false;
  act(() => listeners.forEach((listener) => listener()));

  expect(screen.getByText('system light')).toBeInTheDocument();
  expect(document.documentElement).not.toHaveClass('dark');
});

test('the toggle switches to an explicit theme that is remembered', () => {
  renderTheme();

  fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));

  expect(screen.getByText('dark dark')).toBeInTheDocument();
  expect(document.documentElement).toHaveClass('dark');
  expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
});

test('the picker offers light, dark and the system; "system" forgets the saved choice', () => {
  window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
  renderTheme();
  expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');

  fireEvent.click(screen.getByRole('radio', { name: 'System' }));

  expect(screen.getByText('system light')).toBeInTheDocument();
  expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
});

test('a choice made in another tab applies here', () => {
  renderTheme();

  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: 'dark' }));
  });

  expect(screen.getByText('dark dark')).toBeInTheDocument();
});

test('a saved value that is not a theme counts as no choice', () => {
  window.localStorage.setItem(THEME_STORAGE_KEY, 'purple');

  expect(readPreference()).toBe('system');
  expect(resolveTheme('light')).toBe('light');
});

test('outside a provider the theme is light and fixed', () => {
  render(<Shown />);

  expect(screen.getByText('light light')).toBeInTheDocument();
});

const Colours = () => {
  const chart = useChartTheme();
  return (
    <>
      <p>{chart.primary}</p>
      <p>{chart.series.length}</p>
      <p>{axisProps(chart).stroke}</p>
    </>
  );
};

test('charts read their colours from the tokens, with the light values as a fallback', () => {
  render(<Colours />);

  expect(screen.getByText('rgb(0, 86, 210)')).toBeInTheDocument();
  expect(screen.getByText('6')).toBeInTheDocument();
  expect(screen.getByText('rgb(100, 116, 139)')).toBeInTheDocument();
});

test('the chart tooltip writes each value with the given format', () => {
  const { rerender } = render(
    <ChartTooltip
      active
      label="Aug"
      payload={[{ name: 'Revenue', value: 1250, color: 'red', dataKey: 'revenue' }]}
      format={(value) => `$${value.toFixed(2)}`}
    />
  );
  expect(screen.getByText('Aug')).toBeInTheDocument();
  expect(screen.getByText('$1250.00')).toBeInTheDocument();

  rerender(<ChartTooltip active={false} payload={[]} />);
  expect(screen.queryByText('Aug')).not.toBeInTheDocument();

  render(<ChartLegend items={[{ label: 'Platform', color: 'blue', value: '$10' }]} />);
  expect(screen.getByText('Platform')).toBeInTheDocument();
  expect(screen.getByText('$10')).toBeInTheDocument();
});
