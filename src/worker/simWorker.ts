/// <reference lib="webworker" />
import { simThrough } from "../core/simThrough.js";
import { mulberry32 } from "../engine/rng.js";
import type { WorkerCommand, WorkerResponse } from "./protocol.js";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (e: MessageEvent<WorkerCommand>) => {
  const cmd = e.data;
  if (cmd.type === "sim") {
    // Derive seed from league state so each sim batch is deterministic but different
    const seed = (cmd.league.lid * 1000 + cmd.league.played.length) >>> 0;
    const rng = mulberry32(seed);
    const result = simThrough(cmd.league, cmd.through, rng);
    const response: WorkerResponse = { type: "simResult", league: result };
    self.postMessage(response);
  }
};
