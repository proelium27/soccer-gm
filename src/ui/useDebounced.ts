import { useEffect, useState } from "react";

/**
 * Returns `value` delayed by `delayMs`, so an expensive derivation keyed off it
 * runs once the user stops typing instead of on every keystroke.
 *
 * This exists for the search boxes that scan the whole world (every club's
 * roster). Feeding raw input state straight into that scan meant a nine-letter
 * name cost nine full scans, each one blocking the main thread — which is
 * exactly what INP measures (keystroke to next paint). The input itself stays
 * bound to the undelayed state, so typing still feels instant; only the heavy
 * result list lags behind by `delayMs`.
 */
export function useDebounced<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
