/**
 * SOCCER TICK-LOOP MATCH SIM — proof of concept
 * ------------------------------------------------
 * Adapts the ZenGM hockey approach (clock-driven micro-ticks + a cascade of
 * probability gates, most of which produce NOTHING) to soccer.
 *
 * This file proves ONE thing: the loop produces realistic scorelines.
 * No players, no GM shell, no UI. Teams are represented directly by their
 * "composite ratings" (0..1, 0.5 = league average) — in the real game these
 * would be rolled up from player ratings + formation + synergy, exactly like
 * hockey's updateTeamCompositeRatings().
 */

// ---------- seeded RNG (reproducible, like ZenGM) ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- tunable constants ----------
const MATCH_SECONDS = 5400;      // 90 minutes
const MIN_DT = 2;                // seconds per tick (min)
const MAX_DT = 10;               // seconds per tick (max)

const BASE_CHANCE = 0.032;       // per-tick prob the team on the ball creates a shot
const STRENGTH_K = 0.80;         // how much attack-vs-defense edge swings chance frequency

const BLOCK_BASE = 0.28;         // shot gets blocked
const ONTARGET_BASE = 0.47;      // unblocked shot is on target
const SAVE_BASE = 0.68;          // on-target shot is saved (else goal)

const TURNOVER_BASE = 0.14;      // per-tick prob possession changes hands
const REBOUND_PROB = 0.12;       // after a saved/blocked shot, attacker keeps it

const HOME_ATTACK_BONUS = 0.10;  // home advantage, applied to home attack composite

// ---------- helpers ----------
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

// A team's composites. 0.5 is league average.
function team(name, o = {}) {
  return {
    name,
    attack: o.attack ?? 0.5,     // how often possession escalates into a shot
    finishing: o.finishing ?? 0.5, // shot accuracy + conversion
    defense: o.defense ?? 0.5,   // suppresses opponent chances, blocks shots
    keeping: o.keeping ?? 0.5,   // goalkeeper save rate
    control: o.control ?? 0.5,   // possession retention
  };
}

// ---------- shot resolution cascade (block -> off target -> save -> goal) ----------
function resolveShot(rng, off, def) {
  const blockP = clamp(BLOCK_BASE * (1 + 0.6 * (def.defense - 0.5)), 0.05, 0.6);
  if (rng() < blockP) return "blocked";

  const onTargetP = clamp(ONTARGET_BASE * (1 + 0.5 * (off.finishing - 0.5)), 0.1, 0.9);
  if (rng() >= onTargetP) return "off_target";

  // on target: keeper vs finisher
  const saveP = clamp(
    SAVE_BASE * (1 + 0.5 * (def.keeping - 0.5)) - 0.3 * (off.finishing - 0.5),
    0.2, 0.95
  );
  if (rng() < saveP) return "saved";

  return "goal";
}

// ---------- the tick loop (one match) ----------
function simMatch(rng, home, away) {
  // apply home advantage to a copy of home's attack
  const homeEff = { ...home, attack: clamp(home.attack + HOME_ATTACK_BONUS) };
  const teams = { home: homeEff, away };

  const stat = {
    home: { goals: 0, shots: 0, sot: 0, ticks: 0 },
    away: { goals: 0, shots: 0, sot: 0, ticks: 0 },
  };

  let clock = MATCH_SECONDS;
  let poss = rng() < 0.5 ? "home" : "away"; // kickoff

  while (clock > 0) {
    const dt = MIN_DT + rng() * (MAX_DT - MIN_DT);
    clock -= dt;

    const off = teams[poss];
    const defSide = poss === "home" ? "away" : "home";
    const def = teams[defSide];
    stat[poss].ticks++;

    // possession churn
    const turnoverP = clamp(
      TURNOVER_BASE * (1 + 0.6 * (def.defense - off.control)), 0.02, 0.5
    );
    if (rng() < turnoverP) {
      poss = defSide;
      continue;
    }

    // escalation: does anything happen this tick?
    const edge = off.attack - def.defense;
    const chanceP = clamp(BASE_CHANCE * (1 + STRENGTH_K * edge), 0.002, 0.2);
    if (rng() >= chanceP) {
      // isNothing() — the escape valve that keeps scoring realistic
      continue;
    }

    // a shot happens
    stat[poss].shots++;
    const outcome = resolveShot(rng, off, def);

    // "on target" = saved or scored (blocked and off-target don't count, per real stats)
    if (outcome === "saved" || outcome === "goal") stat[poss].sot++;

    if (outcome === "goal") {
      stat[poss].goals++;
      poss = defSide; // kickoff to conceding team
      continue;
    }

    // blocked / off_target / saved -> maybe rebound, else defense clears
    if (rng() < REBOUND_PROB) {
      // attacker keeps possession (poss unchanged)
    } else {
      poss = defSide;
    }
  }

  return {
    home: stat.home.goals,
    away: stat.away.goals,
    stat,
  };
}

// ---------- Monte Carlo + validation ----------
function runScenario(label, home, away, n, seed) {
  const rng = mulberry32(seed);
  let hG = 0, aG = 0, shots = 0, sot = 0;
  let hW = 0, d = 0, aW = 0, nilnil = 0;
  const scoreCount = new Map();

  for (let i = 0; i < n; i++) {
    const r = simMatch(rng, home, away);
    hG += r.home; aG += r.away;
    shots += r.stat.home.shots + r.stat.away.shots;
    sot += r.stat.home.sot + r.stat.away.sot;
    if (r.home > r.away) hW++;
    else if (r.home < r.away) aW++;
    else d++;
    if (r.home === 0 && r.away === 0) nilnil++;
    const key = `${r.home}-${r.away}`;
    scoreCount.set(key, (scoreCount.get(key) || 0) + 1);
  }

  const pct = (x) => ((100 * x) / n).toFixed(1) + "%";
  const per = (x) => (x / n).toFixed(2);

  const topScores = [...scoreCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k, v]) => `${k} (${pct(v)})`)
    .join(", ");

  console.log(`\n=== ${label} (${n.toLocaleString()} games) ===`);
  console.log(`  Goals/game:      ${per(hG + aG)}  (home ${per(hG)}, away ${per(aG)})`);
  console.log(`  Shots/game:      ${per(shots)}   on target: ${per(sot)}`);
  console.log(`  Results:         home ${pct(hW)} | draw ${pct(d)} | away ${pct(aW)}`);
  console.log(`  0-0 rate:        ${pct(nilnil)}`);
  console.log(`  Common scores:   ${topScores}`);
}

// ---------- benchmarks to beat ----------
console.log("REAL-SOCCER TARGETS (top-flight):");
console.log("  Goals/game ~2.7 | Shots ~25 | On target ~8.5 | Draws ~25% | 0-0 ~7-8%");

const avg = team("Average A");
const avg2 = team("Average B");
runScenario("Two average teams (home vs away)", avg, avg2, 20000, 12345);

const strong = team("Strong", { attack: 0.63, finishing: 0.60, defense: 0.63, keeping: 0.60, control: 0.62 });
const weak = team("Weak", { attack: 0.38, finishing: 0.40, defense: 0.38, keeping: 0.40, control: 0.38 });
runScenario("Strong (home) vs Weak", strong, weak, 20000, 6789);
runScenario("Weak (home) vs Strong", weak, strong, 20000, 4242);
