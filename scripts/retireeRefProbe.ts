/**
 * How much of a long save's history still names the people in it.
 *
 * Every historical surface points at players by pid, but retirement deletes the
 * player and the retiree archive that catches him is quality-gated
 * (`isArchiveWorthy`) and hard-capped (`RETIREE_ARCHIVE_LIMIT`). This counts,
 * per surface, how many distinct pid references resolve to a live player, to an
 * archived career, or to nothing at all ("Player #4821").
 *
 * Usage:
 *   NODE_OPTIONS=--max-old-space-size=20480 npx tsx scripts/retireeRefProbe.ts "<save>" [more saves...]
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { LeagueStore } from "../src/core/leagueState.js";

const FREE_AGENT_TID = -1;

function load(path: string): LeagueStore {
  const raw = readFileSync(path);
  const text = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  return JSON.parse(text) as LeagueStore;
}

function report(path: string): void {
  const L = load(path);
  const live = new Set((L.players ?? []).map((p) => p.pid));
  const arch = new Map((L.retiredPlayers ?? []).map((r) => [r.pid, r]));

  const surfaces = new Map<string, Set<number>>();
  const add = (k: string, pid: number | null | undefined) => {
    if (pid == null) return;
    let s = surfaces.get(k);
    if (!s) surfaces.set(k, (s = new Set()));
    s.add(pid);
  };

  for (const t of L.transfers ?? []) add("transfers", t.pid);
  for (const n of L.newsEvents ?? []) add("newsEvents", (n as { pid?: number }).pid);
  for (const h of L.seasonHistory ?? []) {
    for (const a of Object.values(h.awards ?? {})) {
      add("awards.poty", a.playerOfSeasonPid);
      add("awards.goldenBoot", a.goldenBootPid);
      for (const pid of a.teamOfSeason ?? []) add("awards.tots", pid);
    }
    for (const e of h.world?.ballonDOr ?? []) add("world.ballonDOr", e.pid);
    for (const pid of h.world?.worldTeamOfYear ?? []) add("world.XI", pid);
  }
  for (const c of L.cupHistory ?? []) {
    for (const l of (c as { statLines?: { pid: number }[] }).statLines ?? []) add("cup.statLines", l.pid);
  }
  for (const t of L.international?.history ?? []) add("intl.topScorer", (t as { topScorer?: { pid?: number } }).topScorer?.pid);

  const snapshotted = new Set<number>();
  for (const h of L.seasonHistory ?? []) {
    for (const w of (h as { awardWinners?: { pid: number }[] }).awardWinners ?? []) snapshotted.add(w.pid);
  }

  console.log(`\n# ${path.split("/").pop()}  ·  season ${L.season}`);
  console.log(`players ${(L.players ?? []).length} · archived ${arch.size} · awardWinners snapshotted ${snapshotted.size}`);
  console.log(`\nsurface            distinct    live   archived   NAMELESS   %nameless  (of those, snapshotted)`);
  for (const [k, s] of [...surfaces].sort()) {
    let l = 0, a = 0, n = 0, snap = 0;
    for (const pid of s) {
      if (live.has(pid)) l++;
      else if (arch.has(pid)) a++;
      else { n++; if (snapshotted.has(pid)) snap++; }
    }
    console.log(
      `${k.padEnd(18)} ${String(s.size).padStart(8)} ${String(l).padStart(7)} ${String(a).padStart(10)} ${String(n).padStart(10)} ${((n / s.size) * 100).toFixed(1).padStart(10)}%  ${String(snap).padStart(8)}`,
    );
  }

  // What the archive's prune bar actually is right now.
  const rows = [...arch.values()];
  if (rows.length) {
    const score = (p: { peakOvr: number; seasonsPlayed: number }) => p.peakOvr + Math.min(10, p.seasonsPlayed / 2);
    const sorted = rows.slice().sort((x, y) => score(y) - score(x));
    const worst = sorted[sorted.length - 1];
    const peaks = rows.map((r) => r.peakOvr).sort((a, b) => a - b);
    console.log(`\narchive: ${rows.length} rows; weakest kept = peak ${worst.peakOvr} over ${worst.seasonsPlayed} seasons (score ${score(worst).toFixed(1)})`);
    console.log(`archive peakOvr: min ${peaks[0]} p25 ${peaks[Math.floor(peaks.length * 0.25)]} median ${peaks[Math.floor(peaks.length / 2)]} max ${peaks[peaks.length - 1]}`);
    const eras = new Map<number, number>();
    for (const r of rows) {
      const d = Math.floor(r.retiredSeason / 10) * 10;
      eras.set(d, (eras.get(d) ?? 0) + 1);
    }
    console.log(`archive by retirement decade: ${[...eras].sort((a, b) => a[0] - b[0]).map(([d, c]) => `${d}s:${c}`).join(" ")}`);
  }

  // Transfer log: how many *rows* (not distinct pids) render nameless.
  const tr = (L.transfers ?? []).filter((t) => t.fromTid !== FREE_AGENT_TID || t.toTid !== FREE_AGENT_TID);
  const namelessRows = tr.filter((t) => !live.has(t.pid) && !arch.has(t.pid)).length;
  console.log(`transfer rows: ${tr.length}, nameless ${namelessRows} (${((namelessRows / Math.max(1, tr.length)) * 100).toFixed(1)}%)`);
}

for (const p of process.argv.slice(2)) report(p);
