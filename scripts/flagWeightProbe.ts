/**
 * How many bytes of flag SVG a page actually pulls, per list of players.
 *
 * Flags render at 13px tall but some assets are enormous (bo.svg 240 KB,
 * ec.svg 217 KB, es.svg 153 KB -- detailed coats of arms). The browser has to
 * parse and rasterize every one. This is invisible to Node and jsdom (no layout,
 * no paint), which is why every JS measurement of /transfers came back fast
 * while production INP there is p75 31.5s on mobile.
 */
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import type { LeagueStore } from "../src/core/leagueState.js";
import { searchWorldPlayers, recommendedTransfers } from "../src/core/transfers/recommendations.js";
import { LEAGUE_NATIONALITY_WEIGHTS } from "../src/core/players/nationalities.js";

const cachePath = process.argv[2]
  ?? `${process.env.CLAUDE_JOB_DIR ?? "/tmp"}/tmp/league14.json`;
if (!existsSync(cachePath)) {
  console.error(`No cached league at ${cachePath}. Run leagueSizeDeepDive.ts first.`);
  process.exit(1);
}
const league = JSON.parse(readFileSync(cachePath, "utf8")) as LeagueStore;
league.phase = "offseason";

const FLAG_DIR = "src/ui/assets/flags";
const sizeByFile = new Map<string, number>();
for (const f of readdirSync(FLAG_DIR)) {
  sizeByFile.set(f.replace(/\.svg$/, ""), statSync(`${FLAG_DIR}/${f}`).size);
}

// flagAssets.ts resolves URLs via Vite's import.meta.glob, which doesn't exist
// outside the bundler, so go straight to the shared name -> ISO code map that
// module itself uses.
import { flagCodeFor } from "../src/core/players/flags.js";
function codeFor(nationality: string): string | null {
  const code = flagCodeFor(nationality);
  return code && sizeByFile.has(code) ? code : null;
}

const kb = (n: number) => (n / 1024).toFixed(0).padStart(5);

function weigh(label: string, nationalities: string[]) {
  const distinct = new Set<string>();
  let missing = 0;
  for (const nat of nationalities) {
    const code = codeFor(nat);
    if (code === null) { missing++; continue; }
    distinct.add(code);
  }
  let bytes = 0;
  const heavy: [string, number][] = [];
  for (const code of distinct) {
    const s = sizeByFile.get(code) ?? 0;
    bytes += s;
    if (s > 20_000) heavy.push([code, s]);
  }
  heavy.sort((a, b) => b[1] - a[1]);
  console.log(
    `${label.padEnd(34)} ${String(nationalities.length).padStart(3)} rows, `
    + `${String(distinct.size).padStart(2)} distinct flags, ${kb(bytes)} KB`
    + (missing ? ` (${missing} unmapped)` : ""),
  );
  if (heavy.length > 0) {
    console.log(`    heavy: ${heavy.map(([c, s]) => `${c} ${kb(s)}KB`).join(", ")}`);
  }
}

console.log(`league season ${league.season}\n`);

const rec = recommendedTransfers(league, 0, {});
weigh("Recommended Transfers (default)", rec.map((r) => r.player.nationality));

for (const q of ["a", "e", "o"]) {
  const res = searchWorldPlayers(league, { name: q });
  weigh(`Search name "${q}"`, res.map((r) => r.player.nationality));
}
for (const pos of ["ST", "CB"]) {
  const res = searchWorldPlayers(league, { position: pos });
  weigh(`Search position ${pos}`, res.map((r) => r.player.nationality));
}

// Worst realistic case: every nationality the world can generate.
const allNats = new Set<string>();
for (const weights of Object.values(LEAGUE_NATIONALITY_WEIGHTS)) {
  for (const nat of Object.keys(weights)) allNats.add(nat);
}
weigh("Every nationality in the world", [...allNats]);

const total = [...sizeByFile.values()].reduce((a, b) => a + b, 0);
console.log(`\nall ${sizeByFile.size} flag assets on disk: ${kb(total)} KB`);
console.log("rendered size in the UI: 13px tall (Flag.tsx default)");
