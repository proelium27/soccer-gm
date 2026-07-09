import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { LeagueStore } from "../../core/leagueState.js";
import type { SimThrough } from "../../worker/protocol.js";
import { useSimWorker } from "../useSimWorker.js";
import { saveLeague, loadLeague, listLeagues } from "../../db/leagueDb.js";
import { exportLeagueJSON, importLeagueJSON } from "../../db/exportImport.js";

interface LeagueContextValue {
  league: LeagueStore | null;
  setLeague: (l: LeagueStore) => void;
  simAction: (through: SimThrough) => Promise<void>;
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
  const { sim, simming } = useSimWorker();

  useEffect(() => {
    listLeagues().then(async (list) => {
      if (list.length > 0) {
        const l = await loadLeague(list[0].lid);
        if (l) setLeagueState(l);
      }
    });
  }, []);

  const setLeague = useCallback(async (l: LeagueStore) => {
    const lid = await saveLeague(l);
    const saved = { ...l, lid };
    setLeagueState(saved);
  }, []);

  const simAction = useCallback(async (through: SimThrough) => {
    if (!league) return;
    const result = await sim(through, league);
    const lid = await saveLeague(result);
    setLeagueState({ ...result, lid });
  }, [league, sim]);

  const saveToDb = useCallback(async () => {
    if (league) await saveLeague(league);
  }, [league]);

  const doExport = useCallback(() => {
    if (league) exportLeagueJSON(league);
  }, [league]);

  const doImport = useCallback(async (file: File) => {
    const imported = await importLeagueJSON(file);
    const lid = await saveLeague(imported);
    setLeagueState({ ...imported, lid });
  }, []);

  return (
    <Ctx.Provider value={{
      league,
      setLeague,
      simAction,
      simming,
      saveToDb,
      exportJSON: doExport,
      importJSON: doImport,
    }}>
      {children}
    </Ctx.Provider>
  );
}
