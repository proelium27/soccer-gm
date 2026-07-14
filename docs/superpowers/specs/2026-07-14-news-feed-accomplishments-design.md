# News Feed: player accomplishments

Source: user's "Prompts" Google Doc, "News feed" entry — "In addition to transfers being put in the news feed, player accomplishments should be there too. For example, when a player scores a hattrick."

## Problem

The News Feed page (`src/ui/pages/NewsFeed.tsx`) currently shows only completed transfers, sourced from the append-only `LeagueStore.transfers` array. The user wants player accomplishments (hat-tricks, standout performances, goal milestones) surfaced there too.

The complication: per-match box score data (`league.played`) is wiped every offseason — only season-level aggregates (`SeasonStats`) survive long-term. So accomplishments can't be derived retroactively from stored history the way transfers can; they must be detected at match-sim time and written to a new persisted, append-only store, mirroring how `seasonHistory` snapshots standings before `played` gets cleared.

## Scope

Three accomplishment types, per the user's selection:

1. **Hat-trick** — a player scores 3+ goals in a single match.
2. **Standout rating** — the single highest `computeMatchRating()` performance league-wide on a given matchday, if it clears a floor. One per matchday, at most.
3. **Goal milestones** — a player's running goal total (season and career, tracked independently) crosses a multiple of 10.

Not in scope (deferred, no design given): clean sheet milestones, assist/other-stat milestones, career milestones for stats besides goals.

## Data model

New type in `src/core/leagueState.ts` (or a small sibling module, matching where `CompletedTransfer`/`SeasonHistoryEntry` already live):

```ts
type NewsEventType = "hattrick" | "standoutRating" | "goalMilestoneSeason" | "goalMilestoneCareer";

interface NewsEvent {
  type: NewsEventType;
  pid: number;
  tid: number;
  season: number;
  matchday: number;
  detail: number; // hattrick: goals scored this match; standoutRating: rating x10 (int); milestone: the milestone crossed (10, 20, 30...)
}
```

- `LeagueStore.newsEvents: NewsEvent[]`, default `[]`, append-only — same precedent as `seasonHistory` (`src/core/offseason.ts:162-163`) and `transfers` (`src/core/transfers/negotiation.ts:185-188`).
- Migration: `LeagueStoreAnyVersion` in `src/db/migrate.ts` gains `newsEvents` as optional/`Partial`, defaulted via `anyVersion.newsEvents ?? []`, following the exact pattern already used for `transfers`/`seasonHistory` (`migrate.ts:141-149`).
- `detail` is a single number rather than a per-type object to keep the type flat and JSON-migration-trivial; the UI interprets it per `type`.

## Detection

All detection happens inside `simThrough`'s existing per-matchday loop (`src/core/simThrough.ts:142-208`), which already computes `mdResults` — every `PlayerMatchLine` from every match played on that matchday — before folding them into `SeasonStats` via `accumulateStats` (`simThrough.ts:183`). No new simulation passes are needed; this is pure post-processing on data already in hand.

For each matchday iteration:

1. **Hat-trick**: for every `PlayerMatchLine` across `mdResults` (home + away, all matches) with `goals >= 3`, emit one `NewsEvent` (`type: "hattrick"`, `detail: line.goals`).
2. **Standout rating**: across the same flattened set of lines, find the single highest `.rating`. If it's `>= NEWS_STANDOUT_RATING_FLOOR` (new constant in `src/engine/constants.ts`, proposed `8.0`), emit one `NewsEvent` (`type: "standoutRating"`, `detail: Math.round(rating * 10)`). Ties: first line encountered wins (deterministic given fixed match order — no randomness needed).
3. **Goal milestones**: for every line with `goals > 0`, before `accumulateStats` mutates that player's `stats[]` for this match, sum:
   - `careerBefore` = sum of `goals` across all of `player.stats[]` (all prior seasons + this season's stats-to-date).
   - `seasonBefore` = `goals` from this season's `SeasonStats` entry only (0 if none yet).

   After adding `line.goals`: if `Math.floor(careerBefore / 10) < Math.floor((careerBefore + line.goals) / 10)`, emit `NewsEvent` (`type: "goalMilestoneCareer"`, `detail: Math.floor((careerBefore + line.goals) / 10) * 10`). Same check independently for season, using `goalMilestoneSeason`. Using floor-comparison (not equality) so a hat-trick that jumps a total from 8 to 11 still correctly fires the "10" milestone once. A single match can fire both the season and career milestone for the same player, and it can only ever cross one multiple-of-10 boundary per stat per match in practice (matches are capped well under 10 goals for one player), so no dedup/multi-emit logic is needed beyond the one floor-comparison check per stat.

`tid` on each event is the player's team at match time (available from the match's home/away team ids, matched to which side the line belongs to).

Events accumulate into a local array through the matchday loop and get folded into the `LeagueStore` update `simThrough` already returns (same threading `played`/`players` already use), appended to `league.newsEvents`.

## UI — merged timeline

`src/ui/pages/NewsFeed.tsx`'s per-season card currently renders one `transfers` table. It changes to render one interleaved, chronologically-ordered list combining that season's `transfers` and `newsEvents`.

**Ordering.** Neither event type shares a single native clock, so a synthetic per-season order key is used:
- Transfers: `window === "summer" ? 0 : WINTER_WINDOW_OPEN_MATCHDAY` (existing constant, currently 18) — approximates "summer window happens before matchday 1" and "winter window happens around matchday 18-22."
- Accomplishments: their real `matchday`.

Sorted ascending by this key. Within a tie, transfers render before accomplishments (arbitrary but stable). This isn't exact real-time ordering (all summer-window transfers collapse to key 0 regardless of which offseason sub-step they happened in) but is close enough for a browsable feed and requires no new date-tracking machinery.

**Rendering.** Each row keeps the existing table but the leading cell becomes an icon + label distinguishing event kind instead of always saying a transfer window:
- Hat-trick: ⚽ "Hat-trick" — player, club, `detail` goals, matchday.
- Standout rating: ⭐ "Standout performance" — player, club, rating (`detail / 10`), matchday.
- Goal milestone: 🎯 "`detail` career goals" or "`detail` season goals" — player, club, matchday.
- Transfer rows are unchanged from today (window/player/from/to/fee).

The existing club filter (`clubFilter`) extends to accomplishments by checking `tid` the same way it currently checks `fromTid`/`toTid` on transfers. The existing season filter/dropdown is unaffected (it already scopes by `season`, which both event kinds carry).

The page's intro copy ("Every completed transfer across the league...") updates to mention accomplishments too.

## Testing

- Unit tests for the three detection rules against synthetic `mdResults`/prior `SeasonStats`, covering: exact hat-trick (3 goals), non-hat-trick (2 goals), standout floor boundary (exactly at floor, just under), milestone floor-crossing including the same-match double-digit jump case (8→11), and a player crossing season and career milestones in the same match.
- A `simThrough`-level integration test confirming `newsEvents` accumulates across multiple matchdays and survives an offseason rollover (`league.newsEvents` is never cleared, unlike `played`).
- Existing `migrate.ts` test coverage extended for the `newsEvents ?? []` backfill on an old-shaped save.
