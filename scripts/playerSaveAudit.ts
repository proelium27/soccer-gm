/**
 * Audits a real exported save sent in by a player: where its bytes are, whether
 * its state is internally consistent, and how its dynasty compares to what the
 * headless audits in this directory assume.
 *
 * Reads the *raw* parsed file, deliberately NOT through `migrateLeague` —
 * migration repairs and culls, so auditing a migrated league tells you what the
 * game would fix, not what the player actually has.
 *
 * Usage:
 *   NODE_OPTIONS=--max-old-space-size=20480 npx tsx scripts/playerSaveAudit.ts "/path/to/save.json" [--json]
 *
 * Several checks are deliberately *not* errors — see NOT-A-BUG below — because
 * the save format legitimately keeps references to deleted players and uses -1
 * as a sentinel in three unrelated places.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { LeagueStore } from "../src/core/leagueState.js";
import type { Player } from "../src/core/players/types.js";
import { ROSTER_CAP, ACADEMY_ROSTER_CAP, DIVISION_2_REFUSAL_OVR_THRESHOLD } from "../src/core/constants.js";

const path = process.argv[2];
const asJson = process.argv.includes("--json");
if (!path) {
  console.error("usage: tsx scripts/playerSaveAudit.ts <save.json>");
  process.exit(1);
}

// NOT-A-BUG sentinels, per src/core/transfers/negotiation.ts and cup/types.ts:
//   fromTid/toTid === -1  → a free-agent move (FREE_AGENT_TID)
//   cup.teams[i] === -1   → a bracket slot still awaiting a playoff result
//   leaguePhase goals -1  → fixture not played yet
const FREE_AGENT_TID = -1;

const raw = readFileSync(path);
const text = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
const L = JSON.parse(text) as LeagueStore;

const mb = (n: number) => (n / 1e6).toFixed(2);
const pct = (n: number, d: number) => ((n / d) * 100).toFixed(1);

const out: string[] = [];
const say = (s = "") => out.push(s);

const players = L.players ?? [];
const teams = L.teams ?? [];
const byPid = new Map<number, Player>();
for (const p of players) byPid.set(p.pid, p);
const archived = new Set((L.retiredPlayers ?? []).map((r) => r.pid));
const teamByTid = new Map(teams.map((t) => [t.tid, t]));
const compById = new Map((L.competitions ?? []).map((c) => [c.id, c]));
const userTid = L.meta.userTid;
const ageOf = (p: Player) => L.season - p.born;

say(`# ${path.split("/").pop()}`);
say(`club "${L.meta.name}" (tid ${userTid}) · season ${L.season} · phase ${L.phase}`);
say(`${L.competitions?.length ?? 0} competitions · ${teams.length} clubs · ${players.length} players · godMode=${L.godMode}`);

// ---------------------------------------------------------------- size
say(`\n## SIZE`);
const total = JSON.stringify(L).length;
say(`total ${mb(total)} MB`);
const fields = Object.entries(L as unknown as Record<string, unknown>)
  .map(([k, v]) => [k, JSON.stringify(v ?? null).length] as const)
  .sort((a, b) => b[1] - a[1]);
for (const [k, size] of fields) {
  if (size < 100_000) continue;
  say(`  ${k.padEnd(22)} ${mb(size).padStart(7)} MB  ${pct(size, total).padStart(5)}%`);
}

// played: the within-season ramp, and how much of it is never-read turnovers
const played = L.played ?? [];
if (played.length) {
  let evBytes = 0;
  let turnBytes = 0;
  let turnCount = 0;
  let evCount = 0;
  for (const m of played) {
    for (const e of m.boxScore?.events ?? []) {
      const n = JSON.stringify(e).length;
      evBytes += n;
      evCount++;
      if (e.type === "turnover") {
        turnBytes += n;
        turnCount++;
      }
    }
  }
  const playedBytes = JSON.stringify(played).length;
  const mds = new Set(played.map((m) => m.matchday));
  say(
    `  -- played: ${played.length} matches over ${mds.size} matchdays, ${mb(playedBytes)} MB ` +
      `(${mb(playedBytes / Math.max(mds.size, 1))} MB per matchday)`,
  );
  say(
    `  -- events ${evCount} = ${mb(evBytes)} MB, of which turnover ${turnCount} = ${mb(turnBytes)} MB ` +
      `(${pct(turnBytes, total)}% of the whole save, never rendered)`,
  );
}

// ---------------------------------------------------------------- integrity
say(`\n## INTEGRITY`);
type Finding = { severity: "ERROR" | "WARN" | "INFO"; what: string; detail: string };
const found: Finding[] = [];
const add = (severity: Finding["severity"], what: string, detail: string) => found.push({ severity, what, detail });
const sample = (xs: unknown[], n = 5) => xs.slice(0, n).join(", ") + (xs.length > n ? ` …+${xs.length - n}` : "");

// duplicate pids in the pool
const seen = new Set<number>();
const dupPids: number[] = [];
for (const p of players) {
  if (seen.has(p.pid)) dupPids.push(p.pid);
  seen.add(p.pid);
}
if (dupPids.length) add("ERROR", "duplicate pid in players[]", sample(dupPids));

// pid allocator behind the pool → next created player collides with an existing one
const maxPid = players.reduce((n, p) => Math.max(n, p.pid), -1);
if (typeof L.nextPid !== "number" || !Number.isFinite(L.nextPid)) {
  add("ERROR", "nextPid missing/not finite", String(L.nextPid));
} else if (L.nextPid <= maxPid) {
  add("ERROR", "nextPid <= max existing pid", `nextPid ${L.nextPid}, max pid ${maxPid} → next player reuses a live pid`);
}

// roster references
const onSenior = new Map<number, number[]>(); // pid -> tids
const dangling: string[] = [];
for (const t of teams) {
  for (const pid of t.roster ?? []) {
    if (!byPid.has(pid)) dangling.push(`t${t.tid}:${pid}`);
    onSenior.set(pid, [...(onSenior.get(pid) ?? []), t.tid]);
  }
  for (const pid of t.academyRoster ?? []) {
    if (!byPid.has(pid)) dangling.push(`t${t.tid}(acad):${pid}`);
  }
}
if (dangling.length) add("ERROR", "roster pid not in players[]", sample(dangling));
const doubleRostered = [...onSenior].filter(([, tids]) => tids.length > 1);
if (doubleRostered.length) {
  add("ERROR", "player on more than one senior roster", sample(doubleRostered.map(([pid, tids]) => `${pid}@${tids.join("+")}`)));
}

// squad legality
const smallSquads: string[] = [];
const bigSquads: string[] = [];
const bigAcademies: string[] = [];
for (const t of teams) {
  const n = (t.roster ?? []).length;
  if (n < 11) smallSquads.push(`${t.name}(${t.tid})=${n}`);
  if (n > ROSTER_CAP) bigSquads.push(`${t.name}(${t.tid})=${n}`);
  if ((t.academyRoster ?? []).length > ACADEMY_ROSTER_CAP) bigAcademies.push(`${t.name}=${t.academyRoster.length}`);
}
if (smallSquads.length) add("ERROR", "squad below 11 (selectXI silently under-fills)", sample(smallSquads));
if (bigSquads.length) add("WARN", `squad over ROSTER_CAP (${ROSTER_CAP})`, sample(bigSquads));
if (bigAcademies.length) add("WARN", `academy over cap (${ACADEMY_ROSTER_CAP})`, sample(bigAcademies));

// healthy-XI check: enough uninjured players to field 11, and a fit keeper
const cantField: string[] = [];
const noKeeper: string[] = [];
for (const t of teams) {
  const squad = (t.roster ?? []).map((pid) => byPid.get(pid)).filter((p): p is Player => !!p);
  const fit = squad.filter((p) => !p.injury || p.injury.gamesRemaining <= 0);
  if (fit.length < 11) cantField.push(`${t.name}=${fit.length}`);
  if (!fit.some((p) => p.pos === "GK")) noKeeper.push(`${t.name}`);
}
if (cantField.length) add("ERROR", "fewer than 11 fit players", sample(cantField));
if (noKeeper.length) add("WARN", "no fit keeper (outfielder goes in goal)", sample(noKeeper));

// user-only pid lists must point at that club's own squad
const strayUserLists: string[] = [];
for (const t of teams) {
  const own = new Set([...(t.roster ?? []), ...(t.academyRoster ?? [])]);
  for (const [label, list] of [
    ["starters", t.starters ?? []],
    ["transferListed", t.transferListed ?? []],
    ["moreMinutes", t.moreMinutes ?? []],
  ] as const) {
    for (const pid of list) if (pid !== null && !own.has(pid)) strayUserLists.push(`t${t.tid}.${label}:${pid}`);
  }
  if (t.starters && t.starters.length !== 11) strayUserLists.push(`t${t.tid}.starters len=${t.starters.length}`);
}
if (strayUserLists.length) add("WARN", "starters/transferListed/moreMinutes points off-squad", sample(strayUserLists));

// transient state pointing at players that no longer exist
const transientDead: string[] = [];
for (const l of L.activeLoans ?? []) {
  if (!byPid.has(l.pid)) transientDead.push(`activeLoan:${l.pid}`);
  else {
    const loanee = teamByTid.get(l.loaneeTid);
    if (loanee && !(loanee.roster ?? []).includes(l.pid)) transientDead.push(`activeLoan ${l.pid} not on loanee ${l.loaneeTid}`);
  }
}
for (const n of L.negotiations ?? []) if (!byPid.has(n.pid)) transientDead.push(`negotiation:${n.pid}`);
for (const o of L.inboundOffers ?? []) if (!byPid.has(o.pid)) transientDead.push(`inboundOffer:${o.pid}`);
for (const l of L.loanListings ?? []) if (!byPid.has(l.pid)) transientDead.push(`loanListing:${l.pid}`);
for (const r of L.loanRejections ?? []) if (!byPid.has(r.pid)) transientDead.push(`loanRejection:${r.pid}`);
for (const pid of L.international?.stageInjuries ?? []) if (!byPid.has(pid)) transientDead.push(`stageInjury:${pid}`);
for (const sq of L.international?.qualifying?.squads ?? []) {
  for (const pid of sq.pids) if (!byPid.has(pid)) transientDead.push(`qualSquad ${sq.nation}:${pid}`);
}
for (const sq of L.international?.tournament?.squads ?? []) {
  for (const pid of sq.pids) if (!byPid.has(pid)) transientDead.push(`tourSquad ${sq.nation}:${pid}`);
}
if (transientDead.length) add("ERROR", "live state references a player that does not exist", sample(transientDead, 8));

// numeric sanity
const badNumbers: string[] = [];
const badRatings: string[] = [];
for (const p of players) {
  if (!Number.isFinite(p.ovr) || !Number.isFinite(p.potential)) badNumbers.push(`p${p.pid} ovr=${p.ovr} pot=${p.potential}`);
  else if (p.ovr < 1 || p.ovr > 99 || p.potential < 1 || p.potential > 99) badRatings.push(`p${p.pid} ovr=${p.ovr} pot=${p.potential}`);
  else if (p.potential < p.ovr) badRatings.push(`p${p.pid} pot<ovr ${p.potential}<${p.ovr}`);
  if (!Number.isFinite(p.contract?.salary)) badNumbers.push(`p${p.pid} salary=${p.contract?.salary}`);
  if (p.injury && (!Number.isFinite(p.injury.gamesRemaining) || p.injury.gamesRemaining < 0)) {
    badNumbers.push(`p${p.pid} injury=${p.injury.gamesRemaining}`);
  }
  const a = ageOf(p);
  if (!Number.isFinite(a) || a < 14 || a > 50) badNumbers.push(`p${p.pid} age=${a}`);
}
for (const t of teams) {
  if (!Number.isFinite(t.budget)) badNumbers.push(`t${t.tid} budget=${t.budget}`);
  if (!Number.isFinite(t.hype) || t.hype < 0 || t.hype > 100) badNumbers.push(`t${t.tid} hype=${t.hype}`);
  if (!compById.has(t.compId)) badNumbers.push(`t${t.tid} compId=${t.compId} not a competition`);
}
if (badNumbers.length) add("ERROR", "non-finite / impossible number", sample(badNumbers, 8));
if (badRatings.length) add("WARN", "rating out of range or potential below ovr", sample(badRatings, 8));

// expired contracts still on a roster mid-season
const expired = players.filter(
  (p) => onSenior.has(p.pid) && Number.isFinite(p.contract?.expiresSeason) && p.contract.expiresSeason < L.season,
);
if (expired.length) {
  add("WARN", "rostered player whose contract already expired", `${expired.length} players, e.g. ${sample(expired.slice(0, 5).map((p) => `p${p.pid} expires ${p.contract.expiresSeason}`))}`);
}

// NOT-A-BUG but worth counting: history pointing at deleted players
let deadHistoryRefs = 0;
let recoverable = 0;
for (const t of L.transfers ?? []) {
  if (t.fromTid !== FREE_AGENT_TID && !teamByTid.has(t.fromTid)) add("ERROR", "transfer.fromTid is not a club", `${t.fromTid}`);
  if (!byPid.has(t.pid)) {
    deadHistoryRefs++;
    if (archived.has(t.pid)) recoverable++;
  }
}
for (const e of L.newsEvents ?? []) {
  if (!byPid.has(e.pid)) {
    deadHistoryRefs++;
    if (archived.has(e.pid)) recoverable++;
  }
}
add(
  "INFO",
  "history rows naming a deleted player",
  `${deadHistoryRefs} refs across transfers+newsEvents; ${recoverable} resolve via retiredPlayers, ` +
    `${deadHistoryRefs - recoverable} render as "Player <pid>"`,
);

// award pids that resolve to nothing at all
const awardPids = new Set<number>();
const walkAwards = (o: unknown): void => {
  if (!o || typeof o !== "object") return;
  if (Array.isArray(o)) return void o.forEach(walkAwards);
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (k.endsWith("Pid") && typeof v === "number") awardPids.add(v);
    else if (k === "teamOfSeason" || k === "worldTeamOfYear") {
      for (const x of (v as unknown[]) ?? []) if (typeof x === "number") awardPids.add(x);
    } else if (k === "pid" && typeof v === "number") awardPids.add(v);
    else walkAwards(v);
  }
};
walkAwards(L.seasonHistory ?? []);
walkAwards(L.international?.history ?? []);
const unresolvableAwards = [...awardPids].filter((pid) => pid >= 0 && !byPid.has(pid) && !archived.has(pid));
if (unresolvableAwards.length) {
  add(
    "WARN",
    "honours board pid resolves to nothing",
    `${unresolvableAwards.length} of ${awardPids.size} award pids, e.g. ${sample(unresolvableAwards)}`,
  );
}

// division-2 ceiling (the sweep's own invariant), user club excluded by design
const d2Breaches: string[] = [];
for (const t of teams) {
  if (t.tid === userTid) continue;
  if (compById.get(t.compId)?.tier !== 2) continue;
  for (const pid of t.roster ?? []) {
    const p = byPid.get(pid);
    if (p && p.ovr >= DIVISION_2_REFUSAL_OVR_THRESHOLD) d2Breaches.push(`${t.name}:${p.name}(${p.ovr})`);
  }
}
if (d2Breaches.length) {
  add("WARN", `AI tier-2 player at/over the ${DIVISION_2_REFUSAL_OVR_THRESHOLD} ceiling`, `${d2Breaches.length} players — ${sample(d2Breaches, 4)}`);
}

// solvency
const negative = teams.filter((t) => t.tid !== userTid && t.budget < 0);
if (negative.length) {
  const worst = [...negative].sort((a, b) => a.budget - b.budget).slice(0, 5);
  add("WARN", "AI club in deficit", `${negative.length} clubs, worst ${worst.map((t) => `${t.name} ${(t.budget / 1e6).toFixed(1)}M`).join(", ")}`);
}
const userClub = teamByTid.get(userTid);
if (userClub && userClub.budget < 0) add("INFO", "user club in deficit", `${(userClub.budget / 1e6).toFixed(1)}M`);

for (const sev of ["ERROR", "WARN", "INFO"] as const) {
  for (const f of found.filter((x) => x.severity === sev)) say(`  [${sev}] ${f.what}\n           ${f.detail}`);
}
if (!found.some((f) => f.severity === "ERROR")) say(`  no structural errors found`);

// ---------------------------------------------------------------- balance
say(`\n## BALANCE`);

const tier1 = teams.filter((t) => compById.get(t.compId)?.tier === 1);
const squadOvr = (t: (typeof teams)[number]) => {
  const xs = (t.roster ?? []).map((pid) => byPid.get(pid)?.ovr ?? 0).sort((a, b) => b - a).slice(0, 11);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
};
const byCountry = new Map<string, number[]>();
for (const t of tier1) {
  const c = compById.get(t.compId)!.country;
  byCountry.set(c, [...(byCountry.get(c) ?? []), squadOvr(t)]);
}
say(`strength ladder (mean starting-XI ovr, tier 1):`);
const ladder = [...byCountry]
  .map(([c, xs]) => [c, xs.reduce((a, b) => a + b, 0) / xs.length] as const)
  .sort((a, b) => b[1] - a[1]);
for (const [c, v] of ladder) say(`  ${c.padEnd(10)} ${v.toFixed(2)}`);

const rostered = players.filter((p) => onSenior.has(p.pid));
const free = players.filter((p) => !onSenior.has(p.pid) && !teams.some((t) => (t.academyRoster ?? []).includes(p.pid)));
const meanOvr = (xs: Player[]) => (xs.length ? xs.reduce((a, b) => a + b.ovr, 0) / xs.length : 0);
say(`\npool: ${rostered.length} rostered (mean ovr ${meanOvr(rostered).toFixed(2)}), ${free.length} free agents`);
say(`elite: ${players.filter((p) => p.ovr >= 80).length} at 80+, ${players.filter((p) => p.ovr >= 85).length} at 85+, ${players.filter((p) => p.ovr >= 90).length} at 90+`);
const ages = rostered.map(ageOf).sort((a, b) => a - b);
say(`squad age: mean ${(ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1)}, median ${ages[ages.length >> 1]}, oldest ${ages[ages.length - 1]}`);

// ovr drift over the whole dynasty, from the one per-season record that survives
const prh = L.powerRankingHistory ?? [];
if (prh.length) {
  const perSeason = new Map<number, number[]>();
  for (const snap of prh) {
    for (const r of snap.rows) {
      if (compById.get(r.compId)?.tier !== 1) continue;
      perSeason.set(snap.season, [...(perSeason.get(snap.season) ?? []), r.ovr]);
    }
  }
  const seasons = [...perSeason.keys()].sort((a, b) => a - b);
  const meanFor = (s: number) => {
    const xs = perSeason.get(s)!;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  };
  say(`\ntier-1 mean team ovr by season (inflation drift):`);
  const marks = seasons.filter((_, i) => i % Math.max(1, Math.floor(seasons.length / 12)) === 0 || i === seasons.length - 1);
  say(`  ` + marks.map((s) => `s${s}=${meanFor(s).toFixed(1)}`).join("  "));
  say(`  first ${meanFor(seasons[0]).toFixed(2)} → last ${meanFor(seasons[seasons.length - 1]).toFixed(2)} ` +
    `(drift ${(meanFor(seasons[seasons.length - 1]) - meanFor(seasons[0])).toFixed(2)} over ${seasons.length} seasons)`);
}

// champions and title concentration
const hist = L.seasonHistory ?? [];
if (hist.length) {
  const titleCount = new Map<number, number>();
  const champPts: number[] = [];
  for (const h of hist) {
    for (const [, tid] of Object.entries(h.championTidByCompId ?? {})) {
      if (compById.get(teamByTid.get(tid as number)?.compId ?? -1)?.tier !== 1) continue;
      titleCount.set(tid as number, (titleCount.get(tid as number) ?? 0) + 1);
    }
    for (const [cid, tid] of Object.entries(h.championTidByCompId ?? {})) {
      if (compById.get(Number(cid))?.tier !== 1) continue;
      const row = (h.table ?? []).find((r) => r.tid === tid);
      if (row) champPts.push(row.points);
    }
  }
  const sortedTitles = [...titleCount].sort((a, b) => b[1] - a[1]).slice(0, 6);
  say(`\nchampions over ${hist.length} recorded seasons: ${titleCount.size} distinct tier-1 winners`);
  say(`  most titles: ` + sortedTitles.map(([tid, n]) => `${teamByTid.get(tid)?.name ?? tid} ${n}`).join(", "));
  if (champPts.length) {
    const s = [...champPts].sort((a, b) => a - b);
    say(`  champion points: mean ${(champPts.reduce((a, b) => a + b, 0) / champPts.length).toFixed(1)}, ` +
      `min ${s[0]}, max ${s[s.length - 1]}`);
  }
  const userTitles = titleCount.get(userTid) ?? 0;
  say(`  user club (${userClub?.name}): ${userTitles} tier-1 titles`);
}

// transfer market volume and top end
const tx = L.transfers ?? [];
if (tx.length) {
  const paid = tx.filter((t) => t.fee > 0 && !t.loanSeasons && !t.loanReturn);
  const bySeason = new Map<number, number>();
  for (const t of paid) bySeason.set(t.season, (bySeason.get(t.season) ?? 0) + 1);
  const recent = [...bySeason.keys()].sort((a, b) => a - b).slice(-5);
  const big = paid.filter((t) => t.fee >= 100e6);
  const top = [...paid].sort((a, b) => b.fee - a.fee).slice(0, 5);
  say(`\ntransfers: ${tx.length} rows, ${paid.length} paid moves`);
  say(`  paid moves per season (last 5): ` + recent.map((s) => `s${s}=${bySeason.get(s)}`).join(" "));
  say(`  fees >= $100M: ${big.length} all-time (${(big.length / Math.max(bySeason.size, 1)).toFixed(1)}/season)`);
  say(`  biggest: ` + top.map((t) => `${byPid.get(t.pid)?.name ?? `p${t.pid}`} $${(t.fee / 1e6).toFixed(0)}M s${t.season}`).join(", "));
}

// budgets
const budgets = teams.filter((t) => t.tid !== userTid).map((t) => t.budget).sort((a, b) => a - b);
say(`\nAI budgets: min $${(budgets[0] / 1e6).toFixed(1)}M, median $${(budgets[budgets.length >> 1] / 1e6).toFixed(1)}M, max $${(budgets[budgets.length - 1] / 1e6).toFixed(1)}M`);
if (userClub) say(`user budget: $${(userClub.budget / 1e6).toFixed(1)}M, hype ${userClub.hype.toFixed(1)}, squad ${userClub.roster.length}`);

console.log(out.join("\n"));
if (asJson) {
  console.log("\n@@JSON@@" + JSON.stringify({ file: path, season: L.season, total, findings: found }));
}
