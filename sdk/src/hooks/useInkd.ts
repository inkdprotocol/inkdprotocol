/**
 * @file useInkd.ts
 * @description React hook for the Inkd Protocol client.
 */

import { useState, useCallback, useRef } from "react";
import { InkdClient } from "../InkdClient";
import type {
  InkdClientConfig,
  InkdTokenData,
  Inscription,
  TransactionResult,
  InscribeOptions,
  InscribeResult,
  ProtocolStats,
  Address,
} from "../types";
import type { PublicClient, WalletClient, Account, Chain, Transport } from "viem";

interface UseInkdReturn {
  client: InkdClient;
  connected: boolean;
  connect: (walletClient: WalletClient<Transport, Chain, Account>, publicClient: PublicClient) => void;
  connectArweave: (privateKey: string) => Promise<void>;
  mintToken: (quantity?: number) => Promise<TransactionResult>;
  inscribe: (tokenId: bigint, data: Buffer | Uint8Array | string, options?: InscribeOptions) => Promise<InscribeResult>;
  getToken: (tokenId: bigint) => Promise<InkdTokenData>;
  getInscriptions: (tokenId: bigint) => Promise<Inscription[]>;
  hasInkdToken: (address: Address) => Promise<boolean>;
  getStats: () => Promise<ProtocolStats>;
  error: Error | null;
}

/** Main React hook for Inkd Protocol interaction. */
export function useInkd(config: InkdClientConfig): UseInkdReturn {
  const clientRef = useRef(new InkdClient(config));
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const connect = useCallback(
    (walletClient: WalletClient<Transport, Chain, Account>, publicClient: PublicClient) => {
      clientRef.current.connect(walletClient, publicClient);
      setConnected(true);
      setError(null);
    },
    []
  );

  const connectArweave = useCallback(async (privateKey: string) => {
    try {
      await clientRef.current.connectArweave(privateKey);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, []);

  const mintToken = useCallback(async (quantity?: number) => {
    try {
      const result = await clientRef.current.mintToken({ quantity });
      setError(null);
      return result;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw e;
    }
  }, []);

  const inscribe = useCallback(
    async (tokenId: bigint, data: Buffer | Uint8Array | string, options?: InscribeOptions) => {
      try {
        const result = await clientRef.current.inscribe(tokenId, data, options);
        setError(null);
        return result;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      }
    },
    []
  );

  const getToken = useCallback(async (tokenId: bigint) => {
    try {
      return await clientRef.current.getToken(tokenId);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw e;
    }
  }, []);

  const getInscriptions = useCallback(async (tokenId: bigint) => {
    try {
      return await clientRef.current.getInscriptions(tokenId);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw e;
    }
  }, []);

  const hasInkdToken = useCallback(async (address: Address) => {
    try {
      return await clientRef.current.hasInkdToken(address);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw e;
    }
  }, []);

  const getStats = useCallback(async () => {
    try {
      return await clientRef.current.getStats();
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw e;
    }
  }, []);

  return {
    client: clientRef.current,
    connected,
    connect,
    connectArweave,
    mintToken,
    inscribe,
    getToken,
    getInscriptions,
    hasInkdToken,
    getStats,
    error,
  };
}
