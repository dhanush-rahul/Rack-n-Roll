import { useCallback, useEffect, useRef } from 'react';

const DEFAULT_DEBOUNCE_MS = 800;

export function useDebouncedMatchSave(onSave, debounceMs = DEFAULT_DEBOUNCE_MS) {
  const timersRef = useRef({});
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(
    () => () => {
      Object.values(timersRef.current).forEach((timerId) => clearTimeout(timerId));
    },
    []
  );

  return useCallback(
    (matchKey, payload) => {
      if (timersRef.current[matchKey]) {
        clearTimeout(timersRef.current[matchKey]);
      }

      timersRef.current[matchKey] = setTimeout(() => {
        delete timersRef.current[matchKey];
        onSaveRef.current?.(payload);
      }, debounceMs);
    },
    [debounceMs]
  );
}
