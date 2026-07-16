import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import type { SeasonAwards } from "../../core/awards.js";
import type { Player } from "../../core/players/types.js";
import { FORMATIONS } from "../../core/lineup/formations.js";
import { layoutSlots } from "../pitchLayout.js";
import { getRatingColor } from "../utils/ratingColor.js";
import { PlayerRatingsTooltip } from "../components/PlayerRatingsTooltip.js";
import { Flag } from "../components/Flag.js";
import { BootIcon } from "../components/AwardIcons.js";
import { seasonYear } from "../format.js";

const SLOTS = FORMATIONS["4-3-3"];
const COORDS = layoutSlots(SLOTS);

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

function AwardCard({ title, player, subtitle }: { title: ReactNode; player: Player | undefined; subtitle: string }) {
  return (
    <div className="card h-100">
      <div className="card-body">
        <h6 className="card-title text-muted text-uppercase small d-flex align-items-center gap-1">{title}</h6>
        {player ? (
          <>
            <div className="d-flex align-items-center gap-2 fs-5 fw-semibold">
              <Flag nationality={player.nationality} />
              <Link to={`/player/${player.pid}`}>{player.name}</Link>
            </div>
            <div className="text-muted small mt-1">{subtitle}</div>
          </>
        ) : (
          <p className="text-muted mb-0">Not enough qualifying players.</p>
        )}
      </div>
    </div>
  );
}

function TeamOfSeasonField({ awards, playersByPid }: { awards: SeasonAwards; playersByPid: Map<number, Player> }) {
  return (
    <div className="pitch-field">
      <div className="pitch-goal pitch-goal--left" />
      <div className="pitch-goal pitch-goal--right" />
      {SLOTS.map((_, i) => {
        const pid = awards.teamOfSeason[i];
        const player = pid !== null ? playersByPid.get(pid) : undefined;
        const coord = COORDS[i];
        return (
          <div
            key={i}
            className="pitch-slot"
            style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
          >
            {player ? (
              <PlayerRatingsTooltip player={player}>
                <span
                  className={"pitch-chip" + (player.pos === "GK" ? " pitch-chip--gk" : "")}
                  style={{ borderColor: getRatingColor(player.ovr) }}
                >
                  <Link to={`/player/${player.pid}`} className="pitch-chip-name">
                    {shortName(player.name)}
                  </Link>
                  <span className="pitch-chip-ovr">{player.ovr}</span>
                </span>
              </PlayerRatingsTooltip>
            ) : (
              <span className="pitch-chip" style={{ opacity: 0.4, cursor: "default" }}>—</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Awards() {
  const { league } = useLeague();
  const [season, setSeason] = useState<number | null>(null);
  const [division, setDivision] = useState<0 | 1>(0);

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  if (league.seasonHistory.length === 0) {
    return (
      <div className="container-fluid p-3">
        <h4>Awards</h4>
        <p>No season has been completed yet — awards appear once you advance past your first season.</p>
      </div>
    );
  }

  const seasonOptions = [...league.seasonHistory.map((h) => h.season)].sort((a, b) => b - a);
  const activeSeason = season ?? seasonOptions[0];
  const entry = league.seasonHistory.find((h) => h.season === activeSeason)!;

  const playersByPid = new Map(league.players.map((p) => [p.pid, p]));
  const divisionAwards = entry.awards[division];
  const potd = divisionAwards.playerOfSeasonPid !== null ? playersByPid.get(divisionAwards.playerOfSeasonPid) : undefined;
  const goldenBoot = divisionAwards.goldenBootPid !== null ? playersByPid.get(divisionAwards.goldenBootPid) : undefined;

  const potdStats = potd?.stats.find((s) => s.season === activeSeason);
  const goldenBootStats = goldenBoot?.stats.find((s) => s.season === activeSeason);

  return (
    <div className="container-fluid p-3">
      <h4>Awards</h4>
      <div className="mb-3">
        <select
          className="form-select form-select-sm"
          style={{ width: "auto", display: "inline-block" }}
          value={activeSeason}
          onChange={(e) => setSeason(Number(e.target.value))}
        >
          {seasonOptions.map((s) => (
            <option key={s} value={s}>{seasonYear(s)}</option>
          ))}
        </select>{" "}
        <select
          className="form-select form-select-sm"
          style={{ width: "auto", display: "inline-block" }}
          value={division}
          onChange={(e) => setDivision(Number(e.target.value) as 0 | 1)}
        >
          <option value={0}>English Division 1</option>
          <option value={1}>English Division 2</option>
        </select>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <AwardCard
            title="Player of the Season"
            player={potd}
            subtitle={
              potdStats
                ? `${potdStats.goals}G ${potdStats.assists}A · ${potdStats.avgRating.toFixed(2)} avg rating`
                : ""
            }
          />
        </div>
        <div className="col-md-6">
          <AwardCard
            title={<><BootIcon title="Golden Boot" /> Golden Boot</>}
            player={goldenBoot}
            subtitle={goldenBootStats ? `${goldenBootStats.goals} goals in ${goldenBootStats.appearances} appearances` : ""}
          />
        </div>
      </div>

      <h5>Team of the Season</h5>
      <TeamOfSeasonField awards={divisionAwards} playersByPid={playersByPid} />
    </div>
  );
}
