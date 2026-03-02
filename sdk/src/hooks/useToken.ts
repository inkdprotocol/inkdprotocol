/**
 * @file useToken.ts
 * @description React hook for fetching InkdToken data with loading states.
 */

import { useState, useEffect } from "react";
import type { InkdClient } from "../InkdClient";
import type { InkdTokenData } from "../types";

interface UseTokenReturn {
  token: InkdTokenData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/** Fetch and watch a specific InkdToken's data. */
export function useToken(client: InkdClient, tokenId: bigint): UseTokenReturn {
  const [token, setToken] = useState<InkdTokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchToken() {
      setLoading(true);
      setError(null);
      try {
        const data = await client.getToken(tokenId);
        if (!cancelled) {
          setToken(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchToken();

    return () => {
      cancelled = true;
    };
  }, [client, tokenId, refetchKey]);

  const refetch = () => setRefetchKey((k) => k + 1);

  return { token, loading, error, refetch };
}
