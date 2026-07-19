import { useEffect, useState } from "react";

/**
 * True while the viewport is at or below the mobile breakpoint (the same
 * 767.98px cutoff the responsive CSS uses). Client-only app, so matchMedia is
 * safe; updates on viewport resize / orientation change.
 */
export function useIsMobile(): boolean {
  const query = "(max-width: 767.98px)";
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    // Sync in case the viewport changed between initial state and mount.
    setIsMobile(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
