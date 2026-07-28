/**
 * Fuzz the Transfers page's data paths across many league states and filter
 * combinations, looking for a throw. The page has no error boundary, so any
 * throw in these derivations blanks the whole app.
 */
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { mulberry32 } from "../src/engine/rng.js";
import {
  recommendedTransfers,
  searchWorldPlayers,
} from "../src/core/transfers/recommendations.js";
import {
  acquisitionWageCharge,
  currentNegotiations,
} from "../src/core/transfers/negotiation.js";
import { transferWindowState } from "../src/core/transfers/window.js";
import { POSITIONS } from "../src/core/players/types.js";

const names = ["", "a", "e", "z", "qqq", "o'", "-", "Ø", "van", "  ", "JOSE"];
const nums = [null, 0, -5, 50, 70, 99, 200, 1e9];

let checks = 0;
const failures: string[] = [];

function guard(label: string, fn: () => void) {
  checks++;
  try {
    fn();
  } catch (e) {
    failures.push(`${label}: ${(e as Error).message}`);
  }
}

const rng = mulberry32(99);
let league = createLeagueState(0, rng);

for (let season = 1; season <= 4; season++) {
  for (const phase of ["regular", "offseason"] as const) {
    const l = structuredClone(league);
    l.phase = phase;
    const ws = transferWindowState(l);
    const tag = `s${season}/${phase}/open=${ws.open}`;

    guard(`${tag} recommendedTransfers`, () => {
      const t = recommendedTransfers(l, 0, {});
      for (const r of t) {
        void r.player.contract.salary;
        void acquisitionWageCharge(l, r.player);
      }
    });

    guard(`${tag} currentNegotiations`, () => currentNegotiations(l));

    // Filter sweep over both scans.
    for (const pos of ["", ...POSITIONS]) {
      for (const n of nums) {
        guard(`${tag} rec pos=${pos} n=${n}`, () => {
          recommendedTransfers(l, 0, {
            position: pos || undefined,
            minOvr: n, minPot: n, maxAge: n, maxValue: n,
          });
        });
        guard(`${tag} search pos=${pos} n=${n}`, () => {
          const res = searchWorldPlayers(l, {
            position: pos || undefined,
            minOvr: n, minPot: n, maxAge: n, maxValue: n,
          });
          for (const r of res) void acquisitionWageCharge(l, r.player);
        });
      }
    }
    for (const nm of names) {
      guard(`${tag} search name="${nm}"`, () => {
        const res = searchWorldPlayers(l, { name: nm });
        for (const r of res) void acquisitionWageCharge(l, r.player);
      });
    }
  }

  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);
}

console.log(`checks: ${checks}, failures: ${failures.length}`);
for (const f of failures.slice(0, 25)) console.log("  FAIL", f);
