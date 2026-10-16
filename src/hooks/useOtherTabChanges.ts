import { useEffect, useState } from "react";

/**
 * Reports when another tab writes this save. Browsers only send `storage`
 * events to other tabs, so any event for the key comes from elsewhere.
 */
export function useOtherTabChanges(key: string): boolean {
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    const listen = (event: StorageEvent) => {
      if (event.key !== key && event.key !== null) return;
      try {
        if (event.storageArea !== window.localStorage) return;
      } catch {
        return;
      }
      setChanged(true);
    };
    window.addEventListener("storage", listen);
    return () => window.removeEventListener("storage", listen);
  }, [key]);
  return changed;
}
