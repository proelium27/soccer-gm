/// <reference lib="dom" />
import { useCallback, useEffect, useRef, useState } from "react";
import type { LeagueStore } from "../core/leagueState.js";
import type { SimThrough, WorkerResponse } from "../worker/protocol.js";

export function useSimWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [simming, setSimming] = useState(false);
  const resolveRef = useRef<((league: LeagueStore) => void) | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL("../worker/simWorker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.type === "simResult") {
        setSimming(false);
        resolveRef.current?.(e.data.league);
        resolveRef.current = null;
      }
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const sim = useCallback(
    (through: SimThrough, league: LeagueStore): Promise<LeagueStore> => {
      return new Promise((resolve) => {
        setSimming(true);
        resolveRef.current = resolve;
        workerRef.current?.postMessage({ type: "sim", through, league });
      });
    },
    [],
  );

  return { sim, simming };
}
