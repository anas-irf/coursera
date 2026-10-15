import { useCallback, useState } from 'react';
import type { ChangeEvent } from 'react';

import { thumbnailProblem } from '../lib/course';

/** What ``useThumbnail`` gives a course form. */
export interface ThumbnailState {
  /** The picture chosen, ``null`` for none (or one that was refused). */
  file: File | null;
  /** The chosen picture as a data url, for the preview. */
  preview: string | null;
  /** Why the last file was refused, ``''`` when it was not. */
  error: string;
  /** The ``onChange`` of the file input. */
  pick: (event: ChangeEvent<HTMLInputElement>) => void;
  clear: () => void;
}

/**
 * The picture a course form is about to upload: the chosen file, a preview of it and the reason a
 * file was refused.  ``pick`` is the ``onChange`` of the file input.
 */
export function useThumbnail(): ThumbnailState {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');

  const clear = useCallback(() => {
    setFile(null);
    setPreview(null);
    setError('');
  }, []);

  const pick = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files && event.target.files[0];
    setError('');

    if (!chosen) {
      setFile(null);
      setPreview(null);
      return;
    }

    const problem = thumbnailProblem(chosen);
    if (problem) {
      setError(problem);
      setFile(null);
      setPreview(null);
      event.target.value = ''; // let the same file be chosen again after it is fixed
      return;
    }

    setFile(chosen);
    const reader = new FileReader();
    // readAsDataURL answers text
    reader.onload = () => setPreview(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(chosen);
  }, []);

  return { file, preview, error, pick, clear };
}

export default useThumbnail;
