/// <reference lib="dom" />
import { useCallback, useEffect, useRef, useState } from "react";
import type { LeagueStore } from "../core/leagueState.js";
import type { PlayedMatch } from "../core/standings.js";
import type { SimThrough, WorkerResponse } from "../worker/protocol.js";

export type SimProgress = {
  matchday: number;
  matchdayIndex: number;
  totalMatchdays: number;
  results: PlayedMatch[];
};

export function useSimWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [simming, setSimming] = useState(false);
  const resolveRef = useRef<((league: LeagueStore) => void) | null>(null);
  const progressRef = useRef<((progress: SimProgress) => void) | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL("../worker/simWorker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.type === "simProgress") {
        const { matchday, matchdayIndex, totalMatchdays, results } = e.data;
        progressRef.current?.({ matchday, matchdayIndex, totalMatchdays, results });
        return;
      }
      if (e.data.type === "simResult" || e.data.type === "offseasonResult") {
        setSimming(false);
        resolveRef.current?.(e.data.league);
        resolveRef.current = null;
        progressRef.current = null;
      }
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const sim = useCallback(
    (
      through: SimThrough,
      league: LeagueStore,
      onProgress?: (progress: SimProgress) => void,
    ): Promise<LeagueStore> => {
      return new Promise((resolve) => {
        setSimming(true);
        resolveRef.current = resolve;
        progressRef.current = onProgress ?? null;
        workerRef.current?.postMessage({ type: "sim", through, league });
      });
    },
    [],
  );

  const runOffseason = useCallback(
    (league: LeagueStore): Promise<LeagueStore> => {
      return new Promise((resolve) => {
        setSimming(true);
        resolveRef.current = resolve;
        workerRef.current?.postMessage({ type: "offseason", league });
      });
    },
    [],
  );

  return { sim, runOffseason, simming };
}
