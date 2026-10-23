import React, { useMemo } from 'react';
import type { ReactNode } from 'react';

import { useTheme } from '../theme/ThemeProvider';

/**
 * The colours of a chart, read from the design tokens of the current theme (SVG attributes
 * cannot take CSS variables everywhere, so the values are resolved here).  They are read again
 * when the theme changes; without a stylesheet (the tests) the light defaults apply.
 */
export interface ChartTheme {
  grid: string;
  axis: string;
  text: string;
  surface: string;
  primary: string;
  success: string;
  warning: string;
  danger: string;
  plus: string;
  /** The categorical palette, in order. */
  series: string[];
}

const FALLBACK: Record<string, string> = {
  '--line': '227 232 239',
  '--fg-subtle': '100 116 139',
  '--fg-muted': '71 85 105',
  '--surface-raised': '255 255 255',
  '--primary': '0 86 210',
  '--success': '21 128 61',
  '--warning': '180 83 9',
  '--danger': '220 38 38',
  '--plus': '124 58 237',
  '--chart-1': '0 86 210',
  '--chart-2': '16 185 129',
  '--chart-3': '245 158 11',
  '--chart-4': '139 92 246',
  '--chart-5': '236 72 153',
  '--chart-6': '14 165 233',
};

const read = (styles: CSSStyleDeclaration, name: string): string => {
  const value = styles.getPropertyValue(name).trim() || FALLBACK[name];
  return `rgb(${value.split(/\s+/).join(', ')})`;
};

export function useChartTheme(): ChartTheme {
  const { theme } = useTheme();
  return useMemo(() => {
    const styles = window.getComputedStyle(document.documentElement);
    return {
      grid: read(styles, '--line'),
      axis: read(styles, '--fg-subtle'),
      text: read(styles, '--fg-muted'),
      surface: read(styles, '--surface-raised'),
      primary: read(styles, '--primary'),
      success: read(styles, '--success'),
      warning: read(styles, '--warning'),
      danger: read(styles, '--danger'),
      plus: read(styles, '--plus'),
      series: ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6'].map((name) =>
        read(styles, name)
      ),
    };
    // the tokens change with the theme; reading them again is what the dependency is for
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
}

/** Axis props shared by every chart: quiet ticks, no lines. */
export const axisProps = (chart: ChartTheme) => ({
  stroke: chart.axis,
  tick: { fill: chart.axis, fontSize: 12 },
  tickLine: false,
  axisLine: false,
});

interface TooltipEntry {
  name?: string | number;
  value?: number | string | Array<number | string>;
  color?: string;
  dataKey?: string | number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: ReactNode;
  /** How a value is written ("$1,250.00", "4.5 h"). */
  format?: (value: number) => string;
}

/** The tooltip of every chart, in the colours of the theme. */
export function ChartTooltip({ active, payload, label, format = (value) => value.toLocaleString() }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-line bg-surface-raised px-3 py-2 text-xs shadow-pop">
      {label !== undefined && label !== '' && <p className="mb-1 font-medium text-fg">{label}</p>}
      <ul className="space-y-0.5">
        {payload.map((entry) => (
          <li key={String(entry.dataKey ?? entry.name)} className="flex items-center gap-2 text-fg-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} aria-hidden="true" />
            <span>{entry.name}</span>
            <span className="ml-auto pl-3 font-semibold text-fg tabular-nums">
              {typeof entry.value === 'number' ? format(entry.value) : String(entry.value ?? '')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface LegendItem {
  label: string;
  color: string;
  value?: ReactNode;
}

/** A legend drawn as a list under (or beside) a chart. */
export function ChartLegend({ items, className = '' }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-fg-muted ${className}`}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} aria-hidden="true" />
          <span>{item.label}</span>
          {item.value !== undefined && <span className="font-semibold text-fg tabular-nums">{item.value}</span>}
        </li>
      ))}
    </ul>
  );
}
