/// <reference lib="webworker" />
import { simThrough } from "../core/simThrough.js";
import { simOffseason } from "../core/offseason.js";
import { mulberry32 } from "../engine/rng.js";
import type { WorkerCommand, WorkerResponse } from "./protocol.js";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (e: MessageEvent<WorkerCommand>) => {
  const cmd = e.data;
  if (cmd.type === "sim") {
    // Derive seed from league state so each sim batch is deterministic but different
    const seed = (cmd.league.lid * 1000 + cmd.league.played.length) >>> 0;
    const rng = mulberry32(seed);
    const result = simThrough(
      cmd.league,
      cmd.through,
      rng,
      (matchday, matchdayIndex, totalMatchdays, results, cupTies) => {
        const progress: WorkerResponse = {
          type: "simProgress",
          matchday,
          matchdayIndex,
          totalMatchdays,
          results,
          cupTies,
        };
        self.postMessage(progress);
      },
    );
    const response: WorkerResponse = { type: "simResult", league: result };
    self.postMessage(response);
  } else if (cmd.type === "offseason") {
    const seed = (cmd.league.lid * 1000 + cmd.league.season) >>> 0;
    const rng = mulberry32(seed);
    const result = simOffseason(cmd.league, rng);
    const response: WorkerResponse = { type: "offseasonResult", league: result };
    self.postMessage(response);
  }
};
