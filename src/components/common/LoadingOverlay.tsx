"use client";

import { ApiErrorMessage } from "@/components/common/ApiErrorMessage";
import { NotFoundView } from "@/components/common/NotFoundView";

export function LoadingOverlay({ isLoading = true, showError = false, showNotFound = false, variant = "default", label = "" }: { isLoading?: boolean; showError?: boolean; showNotFound?: boolean; variant?: string; label?: string }) {
  if (!isLoading && !showError && !showNotFound) return null;
  return (
    <div className={`loading-overlay loading-overlay--${variant}`}>
      {isLoading && !showError ? (
        <div className="loading-overlay__panel">
          <div className="loading-overlay__spinner" aria-hidden="true" />
          {label ? <div className="loading-overlay__label">{label}</div> : null}
        </div>
      ) : null}
      {showError || showNotFound ? (
        <div className="loading-overlay__feedback">
          {showError ? <ApiErrorMessage /> : null}
          {showNotFound ? <NotFoundView /> : null}
        </div>
      ) : null}
    </div>
  );
}
