/**
 * @file useInscriptions.ts
 * @description React hook for fetching inscriptions on an InkdToken.
 */

import { useState, useEffect } from "react";
import type { InkdClient } from "../InkdClient";
import type { Inscription } from "../types";

interface UseInscriptionsReturn {
  inscriptions: Inscription[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  activeCount: number;
}

/** Fetch inscriptions on a specific InkdToken with loading states. */
export function useInscriptions(client: InkdClient, tokenId: bigint): UseInscriptionsReturn {
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchInscriptions() {
      setLoading(true);
      setError(null);
      try {
        const data = await client.getInscriptions(tokenId);
        if (!cancelled) {
          setInscriptions(data);
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

    void fetchInscriptions();

    return () => {
      cancelled = true;
    };
  }, [client, tokenId, refetchKey]);

  const refetch = () => setRefetchKey((k) => k + 1);
  const activeCount = inscriptions.filter((i) => !i.isRemoved).length;

  return { inscriptions, loading, error, refetch, activeCount };
}
