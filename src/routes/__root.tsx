import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";

import appCss from "../styles.css?url";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Campaign Copilot — AI-native CRM" },
      {
        name: "description",
        content:
          "AI-native CRM to find customer segments, generate personalized campaigns, pick the best channel, launch, and analyze performance.",
      },
      { property: "og:title", content: "Campaign Copilot — AI-native CRM" },
      {
        property: "og:description",
        content:
          "Find segments, generate personalized campaigns, pick the best channel, launch and analyze — all powered by AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Campaign Copilot — AI-native CRM" },
      {
        name: "description",
        content:
          "Campaign Copilot is an AI-powered CRM dashboard for marketers to build, launch, and analyze customer campaigns.",
      },
      {
        property: "og:description",
        content:
          "Campaign Copilot is an AI-powered CRM dashboard for marketers to build, launch, and analyze customer campaigns.",
      },
      {
        name: "twitter:description",
        content:
          "Campaign Copilot is an AI-powered CRM dashboard for marketers to build, launch, and analyze customer campaigns.",
      },
      { property: "og:image", content: "/og-image.png" },
      { name: "twitter:image", content: "/og-image.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Runtime API URL from Vercel/Nitro env (available during SSR — not baked at build time).
  const runtimeApiBase =
    (typeof process !== "undefined" &&
      (process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || "")) ||
    "";

  return (
    <html lang="en">
      <head>
        <HeadContent />
        {runtimeApiBase ? (
          <>
            <meta name="api-base-url" content={runtimeApiBase.replace(/\/$/, "")} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.__API_BASE_URL__=${JSON.stringify(runtimeApiBase.replace(/\/$/, ""))};`,
              }}
            />
          </>
        ) : null}
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    // Derive WebSocket URL from env var, falling back to localhost for dev.
    // In production VITE_WS_BASE_URL should be e.g. wss://campaign-copilot-api.onrender.com
    const rawWsBase =
      import.meta.env.VITE_WS_BASE_URL ??
      (import.meta.env.VITE_API_BASE_URL
        ? import.meta.env.VITE_API_BASE_URL.replace(/^http/, "ws")
        : "ws://127.0.0.1:8000");
    const wsUrl = rawWsBase.replace(/\/$/, "") + "/ws/live/";

    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = () => {
          // Refresh live CRM data across the app whenever a communication event occurs
          queryClient.invalidateQueries({ queryKey: ["stats"] });
          queryClient.invalidateQueries({ queryKey: ["analytics-charts"] });
          queryClient.invalidateQueries({ queryKey: ["campaigns"] });
        };
        ws.onerror = () => {
          // Silently swallow — WebSocket is a nice-to-have for live updates,
          // not required for the app to function.
        };
        ws.onclose = () => {
          // Retry after 30s if unexpectedly closed (e.g. Render free tier spin-up)
          reconnectTimeout = setTimeout(connect, 30_000);
        };
      } catch {
        // WebSocket not available in this environment — degrade gracefully
      }
    }

    connect();
    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <Outlet />
        </SidebarInset>
        <Toaster />
      </SidebarProvider>
    </QueryClientProvider>
  );
}
