"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is required.");
    return new ConvexReactClient(url);
  }, []);

  return <ConvexAuthNextjsProvider client={client}>{children}</ConvexAuthNextjsProvider>;
}
