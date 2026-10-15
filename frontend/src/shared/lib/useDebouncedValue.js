import { useEffect, useState } from 'react';

/**
 * ``value``, but only once it has stopped changing for ``delay`` ms: a search box feeds this so
 * a request is sent when the user pauses, not for every key.
 */
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default useDebouncedValue;
