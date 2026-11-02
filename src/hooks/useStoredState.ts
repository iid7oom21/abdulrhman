import { useEffect, useState } from 'react';

/** Keep this browser's work between visits; unavailable storage never blocks editing. */
export function useStoredState<T>(
  key: string,
  initial: T,
  validate: (value: unknown) => boolean,
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(key) || 'null');
      return validate(stored) ? (stored as T) : initial;
    } catch {
      return initial;
    }
  });
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [key, value]);

  return [value, setValue, storageError] as const;
}
