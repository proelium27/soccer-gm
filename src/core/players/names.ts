// Placeholder-grade generator: syllable assembly, nationality currently unused
// (an M2 cosmetic concern). Deterministic given the RNG stream.
const ONSETS = ["b", "d", "f", "k", "l", "m", "n", "r", "s", "t", "v", "br", "kr", "st", "gr"];
const NUCLEI = ["a", "e", "i", "o", "u", "ai", "ei", "ou"];
const CODAS = ["n", "r", "s", "l", "k", "", "", "nt", "rk"];

function syllable(rng: () => number): string {
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  return pick(ONSETS) + pick(NUCLEI) + pick(CODAS);
}

function word(rng: () => number, syllables: number): string {
  let s = "";
  for (let i = 0; i < syllables; i++) s += syllable(rng);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function generateName(rng: () => number, _nationality: string): string {
  const first = word(rng, 1 + Math.floor(rng() * 2));
  const last = word(rng, 1 + Math.floor(rng() * 2));
  return `${first} ${last}`;
}
