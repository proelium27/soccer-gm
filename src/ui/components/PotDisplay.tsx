import type { Player } from "../../core/players/types.js";
import { useLeague } from "../context/LeagueContext.js";
import { potentialFog } from "../../core/scouting/potentialFog.js";

const FOG_TITLE =
  "Scouting estimate — sharpens with your scouting spend and how long the player has been on your senior roster.";

/**
 * Renders a player's potential the way the *user* perceives it: an exact
 * number once fully scouted, otherwise a low–high estimate band (see
 * src/core/scouting/potentialFog.ts). Pulls the user's scouting spend and
 * per-player observation tenure from LeagueContext, so every POT display
 * across the app stays consistent by dropping this in place of `p.potential`.
 */
export function PotDisplay({ player }: { player: Player }) {
  const { league } = useLeague();
  if (!league) return <>{player.potential}</>;
  // God Mode is a sandbox — no reason to hide info; show true POT everywhere.
  if (league.godMode) return <>{player.potential}</>;

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  const observed = userTeam?.scoutingObserved?.[player.pid] ?? null;
  const spend = userTeam?.scoutingSpend ?? 0;
  const fog = potentialFog(player.potential, player.pid, league.season, observed, spend);

  if (fog.known) return <>{player.potential}</>;
  return (
    <span title={FOG_TITLE} className="scouting-estimate">
      {fog.low}&ndash;{fog.high}
    </span>
  );
}
