# Second division (promotion/relegation)

Status: approved by user, ready for implementation planning.

## Context

`SOCCER_GM_SPEC.md` §7 lists "promotion/relegation with a second division" as
a v2/M6-menu feature, and its §1 note on the schedule/standings design was
explicit that this was anticipated: "write the schedule and table code so a
second division is a data change, not a rewrite." Checking the current code
confirms that held up — `generateSchedule(teamIds)` and
`computeStandings(teamIds, matches)` are both pure functions over whatever
team-id list is passed in; neither assumes a single flat 20-team league.

This spec adds a second, full senior division (Championship-style, not a
youth/academy league — every club in both divisions has a normal senior
roster) below the existing one, with real promotion/relegation between them.

Decided with the user during brainstorming:

- **20 new clubs**, not a split of the existing 20 — English Division 1 keeps
  its current 20 clubs and 38-match season unchanged; English Division 2 is a
  new, separately-generated 20-club league alongside it.
- **3 up, 3 down** each season, straight automatic swap (no playoff tier).
- Division 2 rosters are generated **noticeably weaker** than Division 1's —
  D2's strongest teams should land around D1's mid-table strength, not near
  the top.
- A promoted/relegated club's underlying generation strength (`academyBase`)
  **shifts gradually toward the new division's band over a few seasons**,
  not instantly — a promoted club has to earn its way up via performance and
  transfers in the meantime, matching how a newly-promoted real club
  typically struggles before adapting. This reuses `academyBase` exactly as
  it exists today — it's already both a club's generation-time strength base
  *and* its permanent youth-intake anchor (`src/core/league/generate.ts`), so
  "gradual convergence" is just nudging that one field a step per season.
- **D2 also gets lower budgets/prize money** than D1, mirroring the real
  financial gap between top-flight and second-tier football revenue —
  reinforces the strength gap and gives promotion a real financial upside
  beyond just a tougher table.
- **Cross-division transfers are allowed.** The AI↔AI transfer market,
  inbound offers for the user's players, and free agency all already operate
  over `league.teams`/the free-agent pool with no concept of division, so
  this requires no filtering — D1 clubs can scout and buy D2 talent and vice
  versa, same as real football.
- **The user's own club is not protected** — it can be relegated exactly like
  any AI club if it finishes bottom-3 in D1.
- **New leagues only** — existing saves stay single-division. No migration
  logic is needed to retroactively split an existing 20-team save in two.
- **Standings, Stat Leaders, and Awards all get a Division dropdown**,
  alongside their existing season dropdowns — these are scoped per-division
  (separate D1/D2 tables and awards), not combined across all 40 clubs. The
  News Feed's existing per-club filters need no new grouping since events are
  already per-club.
- **Division naming**: "Premier League" is a registered trademark — the same
  reason `CLUBS`' default identities were made fictional rather than reusing
  real Premier League club names (see the "Club identities are fictional"
  note in CLAUDE.md). The user chose plain, ungated names instead:
  **"English Division 1"** and **"English Division 2."**

## Data model

- `src/core/constants.ts`: add `NUM_TEAMS_D2 = 20` alongside the existing
  `NUM_TEAMS` (20, unchanged, now implicitly "D1's team count"). Add a new
  `DIVISION_2_OFFSET` constant (strength gap) and `DIVISION_2_BUDGET_SCALE`
  (finance gap) — exact values to be tuned via dynasty audit, not guessed
  blind (see Testing below).
- `LeagueTeam` (`src/core/league/generate.ts`) and `StoredTeam`
  (`src/core/teams/clubs.ts`) both gain `division: 0 | 1` (`0` = English
  Division 1, `1` = English Division 2).
- `CLUBS` (`src/core/teams/clubs.ts`) gains 20 more fictional identities in
  the same style (invented English-flavored place names + colors), for the
  new D2 clubs. `assignIdentities` needs no structural change beyond zipping
  the longer list.
- `LeagueStore.schedule` and `.played` stay flat arrays, unchanged in shape —
  every `ScheduleGame`/`PlayedMatch` is unambiguous by team id, and division
  is looked up via the team, not stored per-match. No new top-level
  `LeagueStore` fields are needed for schedule/results themselves.
- `SeasonHistoryEntry` (`src/core/standings.ts`) needs to record each team's
  division *for that season* (not just its current division, which can have
  since changed via promotion/relegation) — add a `divisionsByTid: Record<number, 0 | 1>`
  snapshot alongside the existing `table`, so a past season's stored table
  and awards can still be filtered/labeled by division correctly even after
  later swaps.

## Generation — initial strength gap

`generateLeague` (`src/core/league/generate.ts`) currently loops
`tid` from `0` to `NUM_TEAMS - 1`, computing an evenly-spaced
`target ∈ [-TEAM_STRENGTH_SPREAD, +TEAM_STRENGTH_SPREAD]` and `base =
LEAGUE_BASE + target` per team. This becomes two passes:

- **D1** (tid `0..NUM_TEAMS-1`): unchanged formula, unchanged band.
- **D2** (tid `NUM_TEAMS..NUM_TEAMS+NUM_TEAMS_D2-1`): same even-spacing
  formula over the same `TEAM_STRENGTH_SPREAD`, but with `DIVISION_2_OFFSET`
  subtracted from `target` before computing `base` — so D2's own strongest
  team lands around D1's mid-table strength band, not just modestly below
  D1's weakest team.

`academyBase` is set from this same per-division `base` at creation, exactly
as today — no change to the per-player generation math itself, only which
`base` value feeds it for D2's tid range.

## Schedule & standings

- `generateSchedule(teamIds)` is called twice — once per division's 20 team
  ids — producing two independent 38-matchday schedules. Matchday numbers
  are shared (both divisions' matchday N happens "at the same time"), so
  `simThrough`'s "sim to matchday N" advances both divisions in lockstep.
  `LeagueStore.schedule` holds both divisions' games concatenated; matchday
  and team id are enough to disambiguate.
- `computeStandings(teamIds, matches)` is called twice per query (UI or
  offseason), filtering `played` by whichever division's team-id set is
  requested — no signature change.
- **Standings page** (`src/ui/pages/Standings.tsx`): a Division dropdown
  next to the existing season dropdown. Selecting a division filters both
  the live table and (for past seasons) the `seasonHistory` snapshot via the
  new `divisionsByTid` map.

## Promotion/relegation (offseason step)

New step in `runOffseason` (`src/core/offseason.ts`), placed after that
season's final D1/D2 standings are computed and *before* `seasonHistory` is
appended (so the historical snapshot still records who was in which division
during the season just finished, not after the swap):

1. Compute both divisions' final tables.
2. Bottom 3 of D1 and top 3 of D2 swap `division` values (on both
   `StoredTeam` and the in-memory team list driving the rest of
   `runOffseason`).
3. Rosters/players are untouched by the swap itself — no re-rolling, no
   instant strength change. Only `academyBase` starts moving: each swapped
   team's `academyBase` shifts a fixed fraction of the remaining distance
   toward its new division's target band each subsequent offseason (e.g.
   1/3 of the remaining gap per season, asymptotically converging within a
   few seasons rather than jumping immediately or never moving). This needs
   a small per-team "which band am I converging toward" bit of bookkeeping —
   simplest approach is recomputing "the new division's band's nearest
   target" from the team's current rank-within-division each time, so no new
   persisted field is required beyond `division` itself.
4. Budgets switch to the new division's budget scale **immediately** (see
   Finance below) — unlike the gradual squad-strength convergence, a
   promoted club's finances jump right away, similar to real
   parachute-payment-style economics, even though its squad hasn't caught up
   yet.

The user's club is swapped by the exact same rule as any AI club — no
special-casing.

## Finance tiering

- `chargeSeasonStart`/`settleSeasonEnd` (`src/core/finance/budget.ts`)
  currently take `BASE_SEASON_BUDGET` and the prize constants
  (`PRIZE_CHAMPION`/`PRIZE_TOP_5`/`PRIZE_TOP_10`) as fixed module constants.
  These calls become scaled by the club's `division`: D1 clubs use the
  values unchanged; D2 clubs multiply all of base/prize by
  `DIVISION_2_BUDGET_SCALE`. `clampBudget`/`MAX_BUDGET` stay a single
  shared ceiling across both divisions (no separate D2 cap) — simplest, and
  a D2 club saturating the shared cap is already an edge case per the
  existing single-division dynasty audits.
- Prize-tier rank cutoffs (`PRIZE_TOP_5_CUTOFF`/`PRIZE_TOP_10_CUTOFF`) are
  relative ranks (1-20), so they apply unchanged within each division's own
  20-team table — no separate D2 cutoffs needed.

## AI GM / cross-division transfers

- `deriveLeagueContexts`, `valueToClub`/`evaluatePlayerForClub`, the AI↔AI
  transfer market (`src/core/ai/transferMarket.ts`), inbound offers
  (`src/core/transfers/inboundOffers.ts`), and AI contract renewals
  (`src/core/ai/renewals.ts`) all currently operate over `league.teams` (or
  the full free-agent pool) with no division filter — cross-division
  transfers work by construction, no code change needed to *allow* them.
- One thing to actually verify, not assume: `ClubContext`'s wealth/ambition
  scalars are league-normalized z-scores today, computed across whatever
  team list is passed in. With D2 clubs structurally poorer
  (`DIVISION_2_BUDGET_SCALE`), pooling both divisions into one normalization
  could skew every D2 club toward "chronically low ambition" in a way that
  wasn't tuned for. This needs re-checking via the dynasty audit below
  rather than assumed safe — if it's a problem, the likely fix is
  normalizing wealth/ambition *within* division rather than league-wide,
  which is a small, contained change to `clubContext.ts` if needed.

## Awards / Stat Leaders scoping

- **Stat Leaders** (`src/ui/pages/Leaders.tsx`): a Division dropdown next to
  the existing season/scope dropdowns. Filtering is by each player's
  *current* club's division for "current season," and by the season's
  stored `divisionsByTid` for past seasons — consistent with how the page
  already handles the existing mid-season-transfer stat-attribution caveat
  (a player's whole season line is attributed to his current club).
- **Awards** (`src/core/awards.ts` / `src/ui/pages/Awards.tsx`):
  `computeSeasonAwards` gains a division-scoped variant (or an optional
  division filter param) so Player of the Season / Golden Boot / Team of the
  Season are each computed separately per division. `SeasonHistoryEntry`'s
  stored `awards` field becomes per-division (two `SeasonAwards`, keyed by
  division) rather than one league-wide set.
- **News Feed**: no change needed — its existing per-club/season filters
  already disambiguate by club regardless of division.

## Testing

- Unit tests for the promotion/relegation swap (correct 3-up-3-down
  selection, tie-break consistency with existing standings sort) and for
  gradual `academyBase` convergence (moves the right direction, doesn't
  overshoot, actually reaches the new band within the intended number of
  seasons).
- A from-scratch multi-season dynasty audit (same pattern used for every
  prior OVR/finance retune in this project) run across several
  promotion/relegation cycles, checking specifically for:
  - No AI deficits under the new D2 budget scale.
  - D2 doesn't structurally death-spiral (a promoted club should be
    competitive within a season or two, not instantly relegated every time).
  - `DIVISION_2_OFFSET`/`DIVISION_2_BUDGET_SCALE` numeric values are picked
    from this audit's actual output, not guessed in advance — same approach
    used for every other constant tuned via dynasty simulation in this
    project's history (see CLAUDE.md's OVR-rebalance and budget-cap-retune
    sections for precedent).
  - Cross-division AI wealth/ambition normalization doesn't produce
    obviously broken behavior (e.g. every D2 club refusing to ever buy
    because it reads as permanently poor).
