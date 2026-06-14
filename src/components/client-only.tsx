import { type ReactNode, useEffect, useState } from "react";

/** Renders children only after client mount — avoids SSR/hydration issues (e.g. Recharts). */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
