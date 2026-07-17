import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import type { LeagueStore } from "../../core/leagueState.js";
import type { SimThrough } from "../../worker/protocol.js";
import { useSimWorker, type SimProgress } from "../useSimWorker.js";
import { saveLeague, loadLeague } from "../../db/leagueDb.js";
import { getActiveLid, setActiveLid, clearActiveLid } from "../../db/activeLeague.js";
import { exportLeagueJSON, importLeagueJSON } from "../../db/exportImport.js";
import {
  signFreeAgent, releasePlayer, signToAcademy, promoteFromAcademy, releaseAcademyPlayer,
} from "../../core/freeAgency.js";
import { clampScoutingSpend } from "../../core/finance/scouting.js";
import { makeTransferOffer, acceptCounterOffer } from "../../core/transfers/negotiation.js";
import {
  acceptInboundOffer, rejectInboundOffer, counterInboundOffer, setTransferListed,
} from "../../core/transfers/inboundOffers.js";
import { extendContract, extendAcademyContract } from "../../core/contracts.js";
import { wouldRefuseExtension } from "../../core/ai/breakoutRefusal.js";
import { applyTeamIdentities, type TeamIdentityEdit } from "../../core/teams/customize.js";
import { isValidStarters } from "../../core/lineup/resolveXI.js";
import { FORMATIONS } from "../../core/lineup/formations.js";
import { SimOverlay } from "../components/SimOverlay.js";

interface LeagueContextValue {
  league: LeagueStore | null;
  loadingActiveLeague: boolean;
  setLeague: (l: LeagueStore) => void;
  loadLeagueAction: (lid: number) => Promise<void>;
  switchLeagueAction: () => void;
  customizeTeamsAction: (lid: number, edits: TeamIdentityEdit[]) => Promise<void>;
  simAction: (through: SimThrough) => Promise<void>;
  offseasonAction: () => Promise<void>;
  signFreeAgentAction: (pid: number) => Promise<void>;
  releasePlayerAction: (pid: number) => Promise<void>;
  signToAcademyAction: (pid: number) => Promise<void>;
  promoteFromAcademyAction: (pid: number) => Promise<void>;
  releaseAcademyPlayerAction: (pid: number) => Promise<void>;
  extendAcademyContractAction: (pid: number) => Promise<void>;
  setScoutingSpendAction: (spend: number) => Promise<void>;
  makeOfferAction: (pid: number, amount: number) => Promise<void>;
  acceptCounterAction: (pid: number) => Promise<void>;
  acceptInboundOfferAction: (pid: number) => Promise<void>;
  rejectInboundOfferAction: (pid: number) => Promise<void>;
  counterInboundOfferAction: (pid: number, amount: number) => Promise<void>;
  extendContractAction: (pid: number) => Promise<void>;
  setTransferListedAction: (pid: number, listed: boolean) => Promise<void>;
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
  const overlayOpenRef = useRef(false);

  // Every league mutation runs through runExclusive and reads the league from
  // leagueRef at execution time. React state alone isn't enough: a callback
  // captures the league from the render it was created in, so two actions
  // fired inside one save's IndexedDB round-trip would both compute from the
  // same stale snapshot and the second save would silently revert the first
  // (lost update). The ref gives queued actions the freshest committed value;
  // the promise chain guarantees only one read-modify-save runs at a time.
  const leagueRef = useRef<LeagueStore | null>(null);
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const pendingOpsRef = useRef(0);
  const [busy, setBusy] = useState(false);

  const commitLeague = useCallback((l: LeagueStore | null) => {
    leagueRef.current = l;
    setLeagueState(l);
  }, []);

  const runExclusive = useCallback((fn: () => Promise<void>): Promise<void> => {
    pendingOpsRef.current++;
    setBusy(true);
    const run = chainRef.current.then(fn).finally(() => {
      pendingOpsRef.current--;
      if (pendingOpsRef.current === 0) setBusy(false);
    });
    chainRef.current = run.catch(() => {});
    return run;
  }, []);

  /** Serialized read-modify-save; `fn` returning null (or the input) is a no-op. */
  const mutate = useCallback(
    (fn: (league: LeagueStore) => LeagueStore | null) =>
      runExclusive(async () => {
        const current = leagueRef.current;
        if (!current) return;
        const updated = fn(current);
        if (!updated || updated === current) return;
        const lid = await saveLeague(updated);
        commitLeague({ ...updated, lid });
      }),
    [runExclusive, commitLeague],
  );

  useEffect(() => {
    const activeLid = getActiveLid();
    if (activeLid === null) return;
    loadLeague(activeLid).then((l) => {
      if (l) commitLeague(l);
      else clearActiveLid();
      setLoadingActiveLeague(false);
    });
  }, [commitLeague]);

  const setLeague = useCallback(async (l: LeagueStore) => {
    const lid = await saveLeague(l);
    const saved = { ...l, lid };
    setActiveLid(lid);
    commitLeague(saved);
  }, [commitLeague]);

  const loadLeagueAction = useCallback(async (lid: number) => {
    const l = await loadLeague(lid);
    if (l) {
      setActiveLid(lid);
      commitLeague(l);
    }
  }, [commitLeague]);

  const switchLeagueAction = useCallback(() => {
    clearActiveLid();
    commitLeague(null);
  }, [commitLeague]);

  // Unlike the mutate-based actions this can target any save, not just the
  // active one — but it still runs through the exclusive chain, and if the
  // edited save IS the active league the fresh copy is committed so the
  // in-memory state can't later overwrite the customization with stale data.
  const customizeTeamsAction = useCallback(
    (lid: number, edits: TeamIdentityEdit[]) =>
      runExclusive(async () => {
        const active = leagueRef.current;
        const target = active?.lid === lid ? active : await loadLeague(lid);
        if (!target) return;
        const updated = applyTeamIdentities(target, edits);
        await saveLeague(updated);
        if (active?.lid === lid) commitLeague(updated);
      }),
    [runExclusive, commitLeague],
  );

  const closeOverlay = useCallback(() => {
    overlayOpenRef.current = false;
    setSimOverlayOpen(false);
    setAnimQueue([]);
    setAnimDone(false);
  }, []);

  const finishSimAnimation = useCallback(() => runExclusive(async () => {
    const result = pendingResultRef.current;
    pendingResultRef.current = null;
    // Persist before dropping the overlay: the overlay is what blocks other
    // actions, so closing it first would open a window where a click reads
    // pre-sim state and gets clobbered by this save.
    if (result) {
      const lid = await saveLeague(result);
      commitLeague({ ...result, lid });
    }
    closeOverlay();
  }), [runExclusive, commitLeague, closeOverlay]);

  const simAction = useCallback((through: SimThrough) => runExclusive(async () => {
    const current = leagueRef.current;
    if (!current || overlayOpenRef.current) return;
    setAnimQueue([]);
    setAnimDone(false);
    overlayOpenRef.current = true;
    setSimOverlayOpen(true);
    try {
      const result = await sim(through, current, (progress) => {
        setAnimQueue((q) => [...q, progress]);
      });
      // Reference equality can't survive the worker's structured clone, so
      // detect a no-op sim by comparing played-game counts.
      if (result.played.length === current.played.length) {
        // Nothing was simmed (e.g. no schedule left) — skip the overlay.
        pendingResultRef.current = null;
        closeOverlay();
        return;
      }
      pendingResultRef.current = result;
      setAnimDone(true);
    } catch (err) {
      pendingResultRef.current = null;
      closeOverlay();
      console.error("Simulation failed:", err);
    }
  }), [runExclusive, sim, closeOverlay]);

  const offseasonAction = useCallback(() => runExclusive(async () => {
    const current = leagueRef.current;
    if (!current) return;
    try {
      const result = await runOffseason(current);
      const lid = await saveLeague(result);
      commitLeague({ ...result, lid });
    } catch (err) {
      console.error("Offseason failed:", err);
    }
  }), [runExclusive, runOffseason, commitLeague]);

  const signFreeAgentAction = useCallback((pid: number) => mutate((l) => {
    const { teams, players } = signFreeAgent(
      l.teams,
      l.players,
      l.meta.userTid,
      pid,
      l.season,
      l.phase,
    );
    if (teams === l.teams && players === l.players) return null;
    return { ...l, teams, players };
  }), [mutate]);

  const makeOfferAction = useCallback((pid: number, amount: number) => mutate(
    (l) => makeTransferOffer(l, pid, amount),
  ), [mutate]);

  const acceptCounterAction = useCallback((pid: number) => mutate(
    (l) => acceptCounterOffer(l, pid),
  ), [mutate]);

  const acceptInboundOfferAction = useCallback((pid: number) => mutate(
    (l) => acceptInboundOffer(l, pid),
  ), [mutate]);

  const rejectInboundOfferAction = useCallback((pid: number) => mutate(
    (l) => rejectInboundOffer(l, pid),
  ), [mutate]);

  const counterInboundOfferAction = useCallback((pid: number, amount: number) => mutate(
    (l) => counterInboundOffer(l, pid, amount),
  ), [mutate]);

  const extendContractAction = useCallback((pid: number) => mutate((l) => {
    const player = l.players.find((p) => p.pid === pid);
    const team = l.teams.find((t) => t.roster.includes(pid));
    if (player && team && wouldRefuseExtension(player, team, l.competitions)) return null;
    return { ...l, players: extendContract(l.players, pid, l.season) };
  }), [mutate]);

  const setTransferListedAction = useCallback((pid: number, listed: boolean) => mutate(
    (l) => setTransferListed(l, pid, listed),
  ), [mutate]);

  const releasePlayerAction = useCallback((pid: number) => mutate((l) => {
    const teams = releasePlayer(l.teams, l.players, l.meta.userTid, pid);
    if (teams === l.teams) return null;
    return { ...l, teams };
  }), [mutate]);

  const signToAcademyAction = useCallback((pid: number) => mutate((l) => {
    const { teams, players } = signToAcademy(
      l.teams, l.players, l.meta.userTid, pid, l.season, l.phase,
    );
    if (teams === l.teams && players === l.players) return null;
    return { ...l, teams, players };
  }), [mutate]);

  const promoteFromAcademyAction = useCallback((pid: number) => mutate((l) => {
    const { teams, players } = promoteFromAcademy(
      l.teams, l.players, l.meta.userTid, pid, l.season, l.phase,
    );
    if (teams === l.teams && players === l.players) return null;
    return { ...l, teams, players };
  }), [mutate]);

  const releaseAcademyPlayerAction = useCallback((pid: number) => mutate((l) => {
    const teams = releaseAcademyPlayer(l.teams, l.meta.userTid, pid);
    if (teams === l.teams) return null;
    return { ...l, teams };
  }), [mutate]);

  const extendAcademyContractAction = useCallback((pid: number) => mutate(
    (l) => ({ ...l, players: extendAcademyContract(l.players, pid, l.season) }),
  ), [mutate]);

  const setLineupAction = useCallback((starters: number[]) => mutate((l) => {
    const user = l.teams.find((t) => t.tid === l.meta.userTid);
    if (!user) return null;
    const rosterSet = new Set(user.roster);
    const rosterPlayers = l.players.filter((p) => rosterSet.has(p.pid));
    // Refuse invalid lineups (duplicate pids, off-roster pids, non-GK in the
    // GK slot) at the action layer so bad state can never be persisted, no
    // matter what the drag-and-drop UI lets through.
    if (!isValidStarters(rosterPlayers, FORMATIONS["4-3-3"], starters)) return null;
    return {
      ...l,
      teams: l.teams.map((t) => (t.tid === l.meta.userTid ? { ...t, starters } : t)),
    };
  }), [mutate]);

  const setScoutingSpendAction = useCallback((spend: number) => mutate((l) => ({
    ...l,
    teams: l.teams.map((t) => {
      if (t.tid !== l.meta.userTid) return t;
      return { ...t, scoutingSpend: clampScoutingSpend(spend, t.budget) };
    }),
  })), [mutate]);

  const saveToDb = useCallback(async () => {
    if (leagueRef.current) await saveLeague(leagueRef.current);
  }, []);

  const doExport = useCallback(() => {
    if (league) exportLeagueJSON(league);
  }, [league]);

  const doImport = useCallback(async (file: File) => {
    const imported = await importLeagueJSON(file);
    const lid = await saveLeague(imported);
    setActiveLid(lid);
    commitLeague({ ...imported, lid });
  }, [commitLeague]);

  return (
    <Ctx.Provider value={{
      league,
      loadingActiveLeague,
      setLeague,
      loadLeagueAction,
      switchLeagueAction,
      customizeTeamsAction,
      simAction,
      offseasonAction,
      signFreeAgentAction,
      releasePlayerAction,
      signToAcademyAction,
      promoteFromAcademyAction,
      releaseAcademyPlayerAction,
      extendAcademyContractAction,
      setScoutingSpendAction,
      makeOfferAction,
      acceptCounterAction,
      acceptInboundOfferAction,
      rejectInboundOfferAction,
      counterInboundOfferAction,
      extendContractAction,
      setTransferListedAction,
      setLineupAction,
      simming: simming || simOverlayOpen || busy,
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
