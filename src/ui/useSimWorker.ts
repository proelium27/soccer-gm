/// <reference lib="dom" />
import { useCallback, useEffect, useRef, useState } from "react";
import type { LeagueStore } from "../core/leagueState.js";
import type { PlayedMatch } from "../core/standings.js";
import type { CupTie } from "../core/cup/types.js";
import type { DomesticTieResult } from "../core/simThrough.js";
import type { SimThrough, IntlMode, WorkerResponse } from "../worker/protocol.js";
import type { LeagueArchive } from "../core/simArchive.js";
import { detachArchive, reattachArchive } from "../core/simArchive.js";

export type SimProgress = {
  matchday: number;
  matchdayIndex: number;
  totalMatchdays: number;
  results: PlayedMatch[];
  cupTies: CupTie[];
  domesticTies: DomesticTieResult[];
};

/** Where a multi-season jump has got to (see core/autopilot.ts). */
export type JumpProgressUpdate = {
  seasonsDone: number;
  totalSeasons: number;
  season: number;
};

type Pending = {
  resolve: (league: LeagueStore) => void;
  reject: (err: Error) => void;
  /**
   * The append-only history held back from this command (core/simArchive.ts),
   * folded back onto whatever the worker returns.
   */
  archive: LeagueArchive;
};

export function useSimWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [simming, setSimming] = useState(false);
  const pendingRef = useRef<Pending | null>(null);
  const progressRef = useRef<((progress: SimProgress) => void) | null>(null);
  const jumpProgressRef = useRef<((progress: JumpProgressUpdate) => void) | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL("../worker/simWorker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.type === "simProgress") {
        const { matchday, matchdayIndex, totalMatchdays, results, cupTies, domesticTies } = e.data;
        progressRef.current?.({
          matchday, matchdayIndex, totalMatchdays, results, cupTies,
          // Absent on a message from an older worker build mid-upgrade.
          domesticTies: domesticTies ?? [],
        });
        return;
      }
      if (e.data.type === "jumpProgress") {
        const { seasonsDone, totalSeasons, season } = e.data;
        jumpProgressRef.current?.({ seasonsDone, totalSeasons, season });
        return;
      }
      if (
        e.data.type === "simResult" ||
        e.data.type === "offseasonResult" ||
        e.data.type === "intlResult" ||
        e.data.type === "jumpResult"
      ) {
        setSimming(false);
        const pending = pendingRef.current;
        pending?.resolve(
          pending.archive ? reattachArchive(e.data.league, pending.archive) : e.data.league,
        );
        pendingRef.current = null;
        progressRef.current = null;
        jumpProgressRef.current = null;
      }
    };
    // An uncaught exception in the worker must reject the pending promise;
    // otherwise the caller awaits forever and the UI is stuck "simming".
    const fail = (message: string) => {
      setSimming(false);
      pendingRef.current?.reject(new Error(message));
      pendingRef.current = null;
      progressRef.current = null;
      jumpProgressRef.current = null;
    };
    worker.onerror = (e: ErrorEvent) => fail(e.message || "simulation worker crashed");
    worker.onmessageerror = () => fail("simulation worker message could not be deserialized");
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const post = useCallback(
    (
      command:
        | { type: "sim"; through: SimThrough; league: LeagueStore }
        | { type: "offseason"; league: LeagueStore }
        | { type: "intl"; mode: IntlMode; league: LeagueStore }
        | { type: "jump"; seasons: number; league: LeagueStore },
      handlers: {
        onProgress?: (progress: SimProgress) => void;
        onJumpProgress?: (progress: JumpProgressUpdate) => void;
      } = {},
    ): Promise<LeagueStore> => {
      return new Promise((resolve, reject) => {
        if (pendingRef.current) {
          reject(new Error("a simulation is already running"));
          return;
        }
        setSimming(true);
        // Hold the append-only history back rather than structured-cloning it
        // to the worker and straight back again — that round trip is what runs
        // a long save out of memory on mobile. See core/simArchive.ts.
        const { payload, archive } = detachArchive(command.league);
        pendingRef.current = { resolve, reject, archive };
        progressRef.current = handlers.onProgress ?? null;
        jumpProgressRef.current = handlers.onJumpProgress ?? null;
        workerRef.current?.postMessage({ ...command, league: payload });
      });
    },
    [],
  );

  const sim = useCallback(
    (
      through: SimThrough,
      league: LeagueStore,
      onProgress?: (progress: SimProgress) => void,
    ): Promise<LeagueStore> => post({ type: "sim", through, league }, { onProgress }),
    [post],
  );

  const runOffseason = useCallback(
    (league: LeagueStore): Promise<LeagueStore> => post({ type: "offseason", league }),
    [post],
  );

  const runIntlStage = useCallback(
    (mode: IntlMode, league: LeagueStore): Promise<LeagueStore> => post({ type: "intl", mode, league }),
    [post],
  );

  const runJump = useCallback(
    (
      seasons: number,
      league: LeagueStore,
      onJumpProgress?: (progress: JumpProgressUpdate) => void,
    ): Promise<LeagueStore> => post({ type: "jump", seasons, league }, { onJumpProgress }),
    [post],
  );

  return { sim, runOffseason, runIntlStage, runJump, simming };
}
