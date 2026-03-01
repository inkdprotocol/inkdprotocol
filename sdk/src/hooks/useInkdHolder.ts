/**
 * @file useInkdHolder.ts
 * @description React hook to check if an address holds an InkdToken.
 */

import { useState, useEffect } from "react";
import type { InkdClient } from "../InkdClient";
import type { Address } from "../types";

interface UseInkdHolderReturn {
  isHolder: boolean;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/** Check if a given address holds at least one InkdToken. */
export function useInkdHolder(client: InkdClient, address: Address): UseInkdHolderReturn {
  const [isHolder, setIsHolder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function checkHolder() {
      setLoading(true);
      setError(null);
      try {
        const result = await client.hasInkdToken(address);
        if (!cancelled) {
          setIsHolder(result);
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

    checkHolder();

    return () => {
      cancelled = true;
    };
  }, [client, address, refetchKey]);

  const refetch = () => setRefetchKey((k) => k + 1);

  return { isHolder, loading, error, refetch };
}
