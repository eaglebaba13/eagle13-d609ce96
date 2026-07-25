// Phase 48 — Closed Beta status banner.
//
// Subtle, single-instance indicator rendered by AppShell above the outlet.
// Dismissible via localStorage; suppressed on auth and public routes.

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "eb.closed-beta-banner.dismissed.v1";

export function ClosedBetaBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  return (
    <div
      role="status"
      aria-label="Closed beta notice"
      className="flex items-start gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-900 dark:text-amber-200"
    >
      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-semibold uppercase tracking-wide">
        Closed Beta
      </span>
      <p className="min-w-0 flex-1">
        Selected features use research or provider-pending data. Verify all actionable
        information independently.
      </p>
      <button
        type="button"
        onClick={() => {
          try {
            window.localStorage.setItem(STORAGE_KEY, "1");
          } catch {
            /* ignore */
          }
          setDismissed(true);
        }}
        aria-label="Dismiss closed beta notice"
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-amber-500/20"
      >
        <X size={12} />
      </button>
    </div>
  );
}