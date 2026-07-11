import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import type { LeagueStore } from "../../core/leagueState.js";
import type { SimThrough } from "../../worker/protocol.js";
import { useSimWorker, type SimProgress } from "../useSimWorker.js";
import { saveLeague, loadLeague } from "../../db/leagueDb.js";
import { getActiveLid, setActiveLid, clearActiveLid } from "../../db/activeLeague.js";
import { exportLeagueJSON, importLeagueJSON } from "../../db/exportImport.js";
import { signFreeAgent, releasePlayer } from "../../core/freeAgency.js";
import { clampScoutingSpend } from "../../core/finance/scouting.js";
import { makeTransferOffer, acceptCounterOffer } from "../../core/transfers/negotiation.js";
import { extendContract } from "../../core/contracts.js";
import { SimOverlay } from "../components/SimOverlay.js";

interface LeagueContextValue {
  league: LeagueStore | null;
  loadingActiveLeague: boolean;
  setLeague: (l: LeagueStore) => void;
  loadLeagueAction: (lid: number) => Promise<void>;
  switchLeagueAction: () => void;
  simAction: (through: SimThrough) => Promise<void>;
  offseasonAction: () => Promise<void>;
  signFreeAgentAction: (pid: number) => Promise<void>;
  releasePlayerAction: (pid: number) => Promise<void>;
  setScoutingSpendAction: (spend: number) => Promise<void>;
  makeOfferAction: (pid: number, amount: number) => Promise<void>;
  acceptCounterAction: (pid: number) => Promise<void>;
  extendContractAction: (pid: number) => Promise<void>;
  setLineupAction: (starters: number[]) => Promise<void>;
  simming: boolean;
  saveToDb: () => Promise<void>;
  exportJSON: () => void;
  importJSON: (file: File) => Promise<void>;
}

const Ctx = createContext<LeagueContextValue | null>(null);

export function useLeague(): LeagueContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLeague must be inside LeagueProvider");
  return ctx;
}

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [league, setLeagueState] = useState<LeagueStore | null>(null);
  const [loadingActiveLeague, setLoadingActiveLeague] = useState(
    () => getActiveLid() !== null,
  );
  const { sim, runOffseason, simming } = useSimWorker();

  const [simOverlayOpen, setSimOverlayOpen] = useState(false);
  const [animQueue, setAnimQueue] = useState<SimProgress[]>([]);
  const [animDone, setAnimDone] = useState(false);
  const pendingResultRef = useRef<LeagueStore | null>(null);

  useEffect(() => {
    const activeLid = getActiveLid();
    if (activeLid === null) return;
    loadLeague(activeLid).then((l) => {
      if (l) setLeagueState(l);
      else clearActiveLid();
      setLoadingActiveLeague(false);
    });
  }, []);

  const setLeague = useCallback(async (l: LeagueStore) => {
    const lid = await saveLeague(l);
    const saved = { ...l, lid };
    setActiveLid(lid);
    setLeagueState(saved);
  }, []);

  const loadLeagueAction = useCallback(async (lid: number) => {
    const l = await loadLeague(lid);
    if (l) {
      setActiveLid(lid);
      setLeagueState(l);
    }
  }, []);

  const switchLeagueAction = useCallback(() => {
    clearActiveLid();
    setLeagueState(null);
  }, []);

  const finishSimAnimation = useCallback(async () => {
    const result = pendingResultRef.current;
    pendingResultRef.current = null;
    setSimOverlayOpen(false);
    setAnimQueue([]);
    setAnimDone(false);
    if (result) {
      const lid = await saveLeague(result);
      setLeagueState({ ...result, lid });
    }
  }, []);

  const simAction = useCallback(async (through: SimThrough) => {
    if (!league || simOverlayOpen) return;
    setAnimQueue([]);
    setAnimDone(false);
    setSimOverlayOpen(true);
    const result = await sim(through, league, (progress) => {
      setAnimQueue((q) => [...q, progress]);
    });
    // Reference equality can't survive the worker's structured clone, so
    // detect a no-op sim by comparing played-game counts.
    if (result.played.length === league.played.length) {
      // Nothing was simmed (e.g. no schedule left) — skip the overlay.
      pendingResultRef.current = null;
      setSimOverlayOpen(false);
      setAnimQueue([]);
      setAnimDone(false);
      return;
    }
    pendingResultRef.current = result;
    setAnimDone(true);
  }, [league, sim, simOverlayOpen]);

  const offseasonAction = useCallback(async () => {
    if (!league) return;
    const result = await runOffseason(league);
    const lid = await saveLeague(result);
    setLeagueState({ ...result, lid });
  }, [league, runOffseason]);

  const signFreeAgentAction = useCallback(async (pid: number) => {
    if (!league) return;
    const { teams, players } = signFreeAgent(
      league.teams,
      league.players,
      league.meta.userTid,
      pid,
      league.season,
    );
    const updated = { ...league, teams, players };
    const lid = await saveLeague(updated);
    setLeagueState({ ...updated, lid });
  }, [league]);

  const makeOfferAction = useCallback(async (pid: number, amount: number) => {
    if (!league) return;
    const updated = makeTransferOffer(league, pid, amount);
    const lid = await saveLeague(updated);
    setLeagueState({ ...updated, lid });
  }, [league]);

  const acceptCounterAction = useCallback(async (pid: number) => {
    if (!league) return;
    const updated = acceptCounterOffer(league, pid);
    const lid = await saveLeague(updated);
    setLeagueState({ ...updated, lid });
  }, [league]);

  const extendContractAction = useCallback(async (pid: number) => {
    if (!league) return;
    const updated = { ...league, players: extendContract(league.players, pid, league.season) };
    const lid = await saveLeague(updated);
    setLeagueState({ ...updated, lid });
  }, [league]);

  const releasePlayerAction = useCallback(async (pid: number) => {
    if (!league) return;
    const teams = releasePlayer(league.teams, league.meta.userTid, pid);
    const updated = { ...league, teams };
    const lid = await saveLeague(updated);
    setLeagueState({ ...updated, lid });
  }, [league]);

  const setLineupAction = useCallback(async (starters: number[]) => {
    if (!league) return;
    const teams = league.teams.map((t) => {
      if (t.tid !== league.meta.userTid) return t;
      return { ...t, starters };
    });
    const updated = { ...league, teams };
    const lid = await saveLeague(updated);
    setLeagueState({ ...updated, lid });
  }, [league]);

  const setScoutingSpendAction = useCallback(async (spend: number) => {
    if (!league) return;
    const teams = league.teams.map((t) => {
      if (t.tid !== league.meta.userTid) return t;
      return { ...t, scoutingSpend: clampScoutingSpend(spend, t.budget) };
    });
    const updated = { ...league, teams };
    const lid = await saveLeague(updated);
    setLeagueState({ ...updated, lid });
  }, [league]);

  const saveToDb = useCallback(async () => {
    if (league) await saveLeague(league);
  }, [league]);

  const doExport = useCallback(() => {
    if (league) exportLeagueJSON(league);
  }, [league]);

  const doImport = useCallback(async (file: File) => {
    const imported = await importLeagueJSON(file);
    const lid = await saveLeague(imported);
    setActiveLid(lid);
    setLeagueState({ ...imported, lid });
  }, []);

  return (
    <Ctx.Provider value={{
      league,
      loadingActiveLeague,
      setLeague,
      loadLeagueAction,
      switchLeagueAction,
      simAction,
      offseasonAction,
      signFreeAgentAction,
      releasePlayerAction,
      setScoutingSpendAction,
      makeOfferAction,
      acceptCounterAction,
      extendContractAction,
      setLineupAction,
      simming: simming || simOverlayOpen,
      saveToDb,
      exportJSON: doExport,
      importJSON: doImport,
    }}>
      {children}
      <SimOverlay
        open={simOverlayOpen}
        teams={league?.teams ?? []}
        queue={animQueue}
        done={animDone}
        userTid={league?.meta.userTid ?? -1}
        onComplete={finishSimAnimation}
      />
    </Ctx.Provider>
  );
}
