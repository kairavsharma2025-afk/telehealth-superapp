import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiError } from "./api";
import type { LookupItem, LookupResult } from "./queries";

// Hook: pass an array of user IDs, get back a Map<id, LookupItem>.
// Dedupes + sorts the input so the query key is stable when the
// caller's array reorders. Backend caps at 200 ids per request, so
// we slice defensively.

export function useLookup(ids: string[]): Map<string, LookupItem> {
  const sorted = useMemo(() => {
    const unique = Array.from(new Set(ids.filter(Boolean))).sort();
    return unique.slice(0, 200);
  }, [ids]);
  const key = sorted.join(",");

  const query = useQuery<LookupResult, ApiError>({
    queryKey: ["users-lookup", key],
    queryFn: () => api<LookupResult>(`/users/lookup?ids=${key}`),
    enabled: sorted.length > 0,
    staleTime: 5 * 60_000,
  });

  return useMemo(() => {
    const m = new Map<string, LookupItem>();
    for (const item of query.data?.items ?? []) m.set(item.id, item);
    return m;
  }, [query.data]);
}
