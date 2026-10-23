import React, { useId } from 'react';
import type { ReactNode } from 'react';

import { cn } from '../../../shared/lib/cn';

/** A unique id for an SVG gradient of a chart (two charts on a page must not share one). */
export function useGradientId(name: string): string {
  return `${name}-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
}

interface ChartFrameProps {
  /** Pixels; the chart takes the full width of its card. */
  height?: number;
  /** What the chart shows, for screen readers (the figures are in the tables and cards around it). */
  label: string;
  className?: string;
  children: ReactNode;
}

/** The box a Recharts chart is drawn in: a fixed height and a name for assistive technology. */
export function ChartFrame({ height = 280, label, className, children }: ChartFrameProps) {
  return (
    <div role="img" aria-label={label} className={cn('w-full', className)} style={{ height }}>
      {children}
    </div>
  );
}

export default ChartFrame;
