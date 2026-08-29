/**
 * Measures what the News Feed actually shows, season by season.
 *
 * The feed reports a world of 16 competitions and 320 clubs, so its failure
 * mode is not a wrong headline but a true one about somewhere you don't play.
 * Two numbers say whether it is working, and they pull against each other:
 *
 *   - volume: rows a season, which has to stay readable as a dynasty ages;
 *   - relevance: the share of those rows touching the user's club or league.
 *
 * A change that cuts volume by dropping the user's own news is a regression
 * however good the first number looks, so always read them together. Also
 * printed: events persisted per season (news events are append-only and live in
 * the save forever, so detection volume is a permanent cost, distinct from what
 * the feed chooses to draw) and the subject's median OVR, which is the quickest
 * read on whether the feed is about players worth reading about.
 *
 * Run: npx tsx scripts/newsRelevanceProbe.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { buildSeasonTimeline, type FeedItem } from "../src/ui/newsFeedTimeline.js";
import { seasonAwardNews } from "../src/core/awardNews.js";
import { FREE_AGENT_TID } from "../src/core/transfers/negotiation.js";

const SEASONS = Number(process.env.SEASONS ?? 5);
const SEED = Number(process.env.SEED ?? 7);

/**
 * With BASELINE=1, reports what the feed drew before relevance tiering: every
 * accomplishment anywhere, and every transfer except other clubs' free-agent
 * churn. Detection is not restorable this way — the ladder in constants.ts
 * decides what reaches the save in the first place — so the `detected` column
 * is the new detector either way, and the old one's volume has to be measured
 * on a checkout of main. Nothing here draws from `rng` (news detection is pure
 * and takes no draws), so both modes sim an identical world.
 */
const BASELINE = process.env.BASELINE === "1";

const rng = mulberry32(SEED);
let league = createLeagueState(0, rng);
const userTid = league.meta.userTid;
const comps = new Map(league.competitions.map((c) => [c.id, c]));
console.log(
  `seed ${SEED}${BASELINE ? " [BASELINE: no relevance tiering]" : ""}, user tid ${userTid} ` +
  `in ${comps.get(league.teams.find((t) => t.tid === userTid)!.compId)?.name} ` +
  `(${league.competitions.length} competitions, ${league.teams.length} clubs)\n`,
);

const median = (xs: number[]) =>
  xs.length === 0 ? 0 : [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

console.log(
  "season".padEnd(7), "shown".padStart(7), "detected".padStart(9), "awards".padStart(7),
  "yourClub".padStart(9), "yourLeague".padStart(11), "medOvr".padStart(7),
);

for (let s = 0; s < SEASONS; s++) {
  league = simThrough(league, "season", rng);
  const season = league.season;
  // Measure AFTER the rollover, not before it. A season's history entry — and
  // so its honours — is written by the offseason that follows, which is also
  // when a player first sees them, so measuring the moment the football ends
  // reports every season as having handed out no awards at all.
  league = simOffseason(league, rng);

  const entry = league.seasonHistory.find((h) => h.season === season);

  // The season's OWN competition map, exactly as the UI reads it: the offseason
  // above has already applied promotion and relegation, so the live teams now
  // describe next season, not the one being measured. The user's club is
  // unmanaged in a headless run, rots and gets relegated, so this genuinely
  // moves over a few seasons.
  const compsByTid: Record<number, number> = { ...(entry?.compsByTid ?? {}) };
  if (!entry) for (const t of league.teams) compsByTid[t.tid] = t.compId;
  const userComp = compsByTid[userTid];

  const seasonEvents = league.newsEvents.filter((e) => e.season === season);
  const seasonTransfers = league.transfers.filter((t) => t.season === season);
  const awards = seasonAwardNews(entry);
  const items: FeedItem[] = BASELINE
    ? [
        ...seasonTransfers
          .filter((t) => t.fromTid !== FREE_AGENT_TID || t.toTid === userTid)
          .map((t): FeedItem => ({ kind: "transfer", order: 0, data: t })),
        ...seasonEvents.map((e): FeedItem => ({ kind: "news", order: e.matchday, data: e })),
      ]
    : buildSeasonTimeline(seasonTransfers, seasonEvents, {
        userTid, userCompId: userComp, compOf: (tid) => compsByTid[tid],
      }, awards);

  const touches = (item: FeedItem, tids: (tid: number) => boolean) => {
    if (item.kind === "transfer") return tids(item.data.fromTid) || tids(item.data.toTid);
    // Continental reallocation is about a country, so it touches no club at
    // all. Counting it under neither tier is right for a probe measuring how
    // much of the feed is about the reader's own clubs.
    if (item.kind === "continental") return false;
    return item.data.tid !== undefined && tids(item.data.tid);
  };
  const club = items.filter((i) => touches(i, (tid) => tid === userTid)).length;
  const league_ = items.filter((i) => touches(i, (tid) => compsByTid[tid] === userComp)).length;

  const pmap = new Map(league.players.map((p) => [p.pid, p]));
  const ovrs = items
    .filter((i) => i.kind === "news")
    .map((i) => pmap.get(i.data.pid)?.ovr)
    .filter((o): o is number => o !== undefined);

  const pct = (n: number) => `${((100 * n) / Math.max(1, items.length)).toFixed(1)}%`;
  console.log(
    String(season).padEnd(7),
    String(items.length).padStart(7),
    String(seasonEvents.length).padStart(9),
    String(items.filter((i) => i.kind === "award").length).padStart(7),
    `${club} ${pct(club)}`.padStart(9),
    `${league_} ${pct(league_)}`.padStart(11),
    String(median(ovrs)).padStart(7),
  );
}
