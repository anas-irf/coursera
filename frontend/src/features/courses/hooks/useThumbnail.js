import { useCallback, useState } from 'react';

import { thumbnailProblem } from '../lib/course';

/**
 * The picture a course form is about to upload: the chosen file, a preview of it and the reason a
 * file was refused.  ``pick`` is the ``onChange`` of the file input.
 */
export function useThumbnail() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const clear = useCallback(() => {
    setFile(null);
    setPreview(null);
    setError('');
  }, []);

  const pick = useCallback((event) => {
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
    reader.onload = (loaded) => setPreview(loaded.target.result);
    reader.readAsDataURL(chosen);
  }, []);

  return { file, preview, error, pick, clear };
}

export default useThumbnail;
