import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { ClientOnly } from "@/components/client-only";

/** Fixed-height chart area that mounts Recharts only on the client. */
export function ChartShell({
  heightClass = "h-72",
  children,
  empty,
  isEmpty = false,
}: {
  heightClass?: string;
  children: ReactNode;
  empty?: ReactNode;
  isEmpty?: boolean;
}) {
  const skeleton = (
    <div
      className={`flex ${heightClass} w-full items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/20`}
    >
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  if (isEmpty && empty) {
    return (
      <div
        className={`flex ${heightClass} w-full items-center justify-center text-sm text-muted-foreground`}
      >
        {empty}
      </div>
    );
  }

  return (
    <ClientOnly fallback={skeleton}>
      <div className={`${heightClass} w-full min-h-[12rem]`}>{children}</div>
    </ClientOnly>
  );
}
