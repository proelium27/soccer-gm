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

type Pending = {
  resolve: (league: LeagueStore) => void;
  reject: (err: Error) => void;
};

export function useSimWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [simming, setSimming] = useState(false);
  const pendingRef = useRef<Pending | null>(null);
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
        pendingRef.current?.resolve(e.data.league);
        pendingRef.current = null;
        progressRef.current = null;
      }
    };
    // An uncaught exception in the worker must reject the pending promise;
    // otherwise the caller awaits forever and the UI is stuck "simming".
    const fail = (message: string) => {
      setSimming(false);
      pendingRef.current?.reject(new Error(message));
      pendingRef.current = null;
      progressRef.current = null;
    };
    worker.onerror = (e: ErrorEvent) => fail(e.message || "simulation worker crashed");
    worker.onmessageerror = () => fail("simulation worker message could not be deserialized");
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const post = useCallback(
    (
      command: { type: "sim"; through: SimThrough; league: LeagueStore } | { type: "offseason"; league: LeagueStore },
      onProgress: ((progress: SimProgress) => void) | null,
    ): Promise<LeagueStore> => {
      return new Promise((resolve, reject) => {
        if (pendingRef.current) {
          reject(new Error("a simulation is already running"));
          return;
        }
        setSimming(true);
        pendingRef.current = { resolve, reject };
        progressRef.current = onProgress;
        workerRef.current?.postMessage(command);
      });
    },
    [],
  );

  const sim = useCallback(
    (
      through: SimThrough,
      league: LeagueStore,
      onProgress?: (progress: SimProgress) => void,
    ): Promise<LeagueStore> => post({ type: "sim", through, league }, onProgress ?? null),
    [post],
  );

  const runOffseason = useCallback(
    (league: LeagueStore): Promise<LeagueStore> => post({ type: "offseason", league }, null),
    [post],
  );

  return { sim, runOffseason, simming };
}
