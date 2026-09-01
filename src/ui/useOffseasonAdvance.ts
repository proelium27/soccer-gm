import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLeague } from "./context/LeagueContext.js";
import { isSpectator } from "../core/spectator.js";

/**
 * The one way to move a save out of the offseason.
 *
 * A managed save routes to `/set-scouting` first: the scouting budget is a
 * decision the game deliberately refuses to let you skip season after season,
 * so the checkpoint owns the advance and calls `offseasonAction` itself.
 *
 * A spectator has no club, so no budget and nothing to check. Sending them to
 * that page would be worse than useless — it renders a gate it cannot fill and
 * bounces straight back — so they advance directly.
 *
 * Both the Dashboard card and the TopBar's Sim dropdown offer this, and they
 * must not disagree about which route a given save takes, so the decision lives
 * here rather than being written out twice.
 */
export function useOffseasonAdvance(): () => Promise<void> {
  const { league, offseasonAction } = useLeague();
  const navigate = useNavigate();

  return useCallback(async () => {
    if (!league) return;
    if (!isSpectator(league)) {
      navigate("/set-scouting");
      return;
    }
    await offseasonAction();
    navigate("/season-preview");
  }, [league, offseasonAction, navigate]);
}
