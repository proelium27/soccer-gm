import { parseArgs } from "node:util";
import { mulberry32 } from "../src/engine/rng.js";
import { simMatch } from "../src/engine/matchSim.js";
import { runScenario, PRESETS } from "../src/engine/montecarlo.js";
import type { Composites } from "../src/engine/composites.js";

function resolvePreset(name: string): Composites {
  if (name === "equal" || name === "strong" || name === "weak") {
    return PRESETS[name];
  }
  throw new Error(`unknown preset "${name}" (use equal | strong | weak)`);
}

function pct(x: number): string {
  return x.toFixed(1) + "%";
}

function runMatch(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      home: { type: "string", default: "strong" },
      away: { type: "string", default: "weak" },
      seed: { type: "string", default: "42" },
    },
  });
  const home = resolvePreset(values.home!);
  const away = resolvePreset(values.away!);
  const rng = mulberry32(Number(values.seed));
  const r = simMatch(rng, home, away);

  console.log(`${home.name} ${r.home} - ${r.away} ${away.name}`);
  console.log(`             ${home.name.padStart(6)}  ${away.name.padStart(6)}`);
  console.log(
    `  Shots      ${String(r.stat.home.shots).padStart(6)}  ${String(r.stat.away.shots).padStart(6)}`,
  );
  console.log(
    `  On target  ${String(r.stat.home.sot).padStart(6)}  ${String(r.stat.away.sot).padStart(6)}`,
  );
  console.log(
    `  Possession ${pct(100 * r.possessionHome).padStart(6)}  ${pct(100 * (1 - r.possessionHome)).padStart(6)}`,
  );
}

function runBench(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      scenario: { type: "string", default: "equal" },
      n: { type: "string", default: "20000" },
      seed: { type: "string", default: "12345" },
    },
  });
  const scenario = values.scenario!;
  const n = Number(values.n);
  const seed = Number(values.seed);

  const pairs: Record<string, [Composites, Composites]> = {
    equal: [PRESETS.equal, PRESETS.equal],
    mismatch: [PRESETS.strong, PRESETS.weak],
    upset: [PRESETS.weak, PRESETS.strong],
  };
  const pair = pairs[scenario];
  if (!pair) throw new Error(`unknown scenario "${scenario}" (equal | mismatch | upset)`);

  const r = runScenario(pair[0], pair[1], n, seed);
  console.log(`=== ${scenario} (${n.toLocaleString()} games, seed ${seed}) ===`);
  console.log(
    `  Goals/game:    ${r.goalsPerGame.toFixed(2)}  (home ${r.homeGoals.toFixed(2)}, away ${r.awayGoals.toFixed(2)})`,
  );
  console.log(`  Shots/game:    ${r.shotsPerGame.toFixed(2)}   on target: ${r.sotPerGame.toFixed(2)}`);
  console.log(
    `  Results:       home ${pct(r.homeWinPct)} | draw ${pct(r.drawPct)} | away ${pct(r.awayWinPct)}`,
  );
  console.log(`  0-0 rate:      ${pct(r.nilNilPct)}`);
  console.log(
    `  Common scores: ${r.topScores.map((s) => `${s.score} (${pct(s.pct)})`).join(", ")}`,
  );
}

const [command, ...rest] = process.argv.slice(2);
if (command === "match") runMatch(rest);
else if (command === "bench") runBench(rest);
else {
  console.log("usage: npm run cli <match|bench> [options]");
  console.log("  match --home <preset> --away <preset> --seed <n>");
  console.log("  bench --scenario <equal|mismatch|upset> --n <n> --seed <n>");
  process.exit(command ? 1 : 0);
}
