import "server-only";

import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";

export async function convexServerClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const token = await convexAuthNextjsToken();
  if (!url) throw new Error("Convex is not configured.");
  if (!token) throw new Error("Unauthorized");
  const client = new ConvexHttpClient(url);
  client.setAuth(token);
  return client;
}

/** Convert Convex documents to the stable `id` shape used by the browser UI. */
export function toClientValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(toClientValue) as T;
  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(input)) {
      if (key !== "_creationTime") output[key] = toClientValue(item);
    }
    if (typeof input._id === "string") output.id = input._id;
    return output as T;
  }
  return value;
}

export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed.";
  const status = message === "Unauthorized" ? 401 : 400;
  return Response.json({ error: message }, { status });
}
