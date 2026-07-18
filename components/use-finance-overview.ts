"use client";

import { useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function useFinanceOverview(month = currentMonth()) {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(api.finance.overview, isAuthenticated ? { month } : "skip");
}
