import React, { useId, useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import { ExternalLink, FileText, UploadCloud, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { buttonClasses } from './Button';
import { cn } from '../lib/cn';

interface FileDropProps {
  /** The id the field's label points at: the file input takes it (``Field`` passes it). */
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  /** The ``accept`` of the file input (".pdf,.docx", "image/*" ...). */
  accept: string;
  /** What to do here, in the box ("Upload a PDF"). */
  title: ReactNode;
  /** The formats and the size limit. */
  hint?: ReactNode;
  icon?: LucideIcon;
  /** The label of the button inside the box. */
  buttonLabel?: string;
  /**
   * A file was chosen or dropped.  ``reset`` empties the input, so the same file can be chosen
   * again after the caller refused it.
   */
  onFile: (file: File, reset: () => void) => void;
  /** The file chosen in this dialog, shown under the box with a way to remove it. */
  file?: File | null;
  onRemove?: () => void;
  /** What is stored now (the lecture being edited), with a link to it. */
  current?: { name: string; url?: string | null } | null;
  disabled?: boolean;
  /** Replaces the box while a file is being sent ("Uploading video..."). */
  busy?: ReactNode;
}

const megabytes = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/**
 * A dashed box to pick a file in, or to drop one on.  It is a label of the file input, so the
 * whole box opens the file chooser and the input keeps the field's name for screen readers.
 */
const FileDrop = ({
  id,
  accept,
  title,
  hint,
  icon: Icon = UploadCloud,
  buttonLabel = 'Choose file',
  onFile,
  file = null,
  onRemove,
  current = null,
  disabled = false,
  busy = null,
  ...aria
}: FileDropProps) => {
  const generated = useId();
  const inputId = id || generated;
  const [over, setOver] = useState(false);

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setOver(false);
    if (disabled) return;
    const dropped = event.dataTransfer.files && event.dataTransfer.files[0];
    if (dropped) onFile(dropped, () => {});
  };

  return (
    <div className="space-y-3">
      {current && !file && (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-muted/60 px-3 py-2.5">
          <FileText size={16} aria-hidden="true" className="shrink-0 text-fg-subtle" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-fg-subtle">Current file</p>
            <p className="truncate text-sm font-medium text-fg">{current.name}</p>
          </div>
          {current.url && (
            <a
              href={current.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary-fg hover:underline"
            >
              View <ExternalLink size={12} aria-hidden="true" />
            </a>
          )}
        </div>
      )}

      {busy || (
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-7 text-center transition-colors',
            'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-surface',
            disabled
              ? 'cursor-not-allowed border-line opacity-60'
              : over
                ? 'cursor-copy border-primary bg-primary-soft/50'
                : 'cursor-pointer border-line-strong bg-surface-muted/40 hover:border-primary hover:bg-primary-soft/30'
          )}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary-fg">
            <Icon size={20} aria-hidden="true" />
          </span>
          <span className="text-sm font-medium text-fg">{title}</span>
          {hint && <span className="text-xs text-fg-subtle">{hint}</span>}
          <span className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'mt-1 pointer-events-none' })}>
            {buttonLabel}
          </span>
          <input
            id={inputId}
            type="file"
            accept={accept}
            disabled={disabled}
            className="sr-only"
            onChange={(event) => {
              const input = event.target;
              const chosen = input.files && input.files[0];
              if (chosen) onFile(chosen, () => { input.value = ''; });
            }}
            {...aria}
          />
        </label>
      )}

      {file && (
        <div className="flex items-center gap-3 rounded-lg border border-success-fg/25 bg-success-soft px-3 py-2.5">
          <FileText size={16} aria-hidden="true" className="shrink-0 text-success-fg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{file.name}</p>
            <p className="text-xs text-fg-subtle">{megabytes(file.size)}</p>
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${file.name}`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface hover:text-fg"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FileDrop;
