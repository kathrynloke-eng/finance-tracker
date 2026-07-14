"use client";

import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function useFinanceOverview(month = currentMonth()) {
  const { isAuthenticated } = useConvexAuth();
  const initialize = useMutation(api.users.initialize);
  const redactStatementFilenames = useMutation(api.finance.redactStatementFilenames);
  useEffect(() => {
    if (!isAuthenticated) return;
    void initialize({});
    void redactStatementFilenames({});
  }, [initialize, isAuthenticated, redactStatementFilenames]);
  return useQuery(api.finance.overview, isAuthenticated ? { month } : "skip");
}
