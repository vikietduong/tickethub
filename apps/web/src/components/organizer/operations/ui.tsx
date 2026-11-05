import { operationError } from "@/lib/organizer-operations";
import type { ReactNode } from "react";
export const panel = "rounded-xl border border-border bg-background p-5 sm:p-6";
export const field =
  "mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";
export function OperationError({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="my-4 rounded-xl border border-destructive/40 bg-background p-4 text-sm text-destructive"
    >
      <p>{operationError(error)}</p>
      {retry && (
        <button type="button" className="mt-2 underline" onClick={retry}>
          Thử lại
        </button>
      )}
    </div>
  );
}
export function Metric({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={panel}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-2 break-words text-2xl font-bold tabular-nums">
        {children}
      </dd>
    </div>
  );
}
