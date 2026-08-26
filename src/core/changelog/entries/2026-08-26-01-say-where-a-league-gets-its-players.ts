import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-26",
  title: "Say where a league you add gets its players",
  items: [
    "A league you added generated English players. All of it: you could call it Netherlands, set it up as a Dutch league, and its squads still came out 38% English, with English names to match. Real nationality breakdowns only ever existed for the eight countries the game ships, and anything else fell back to England's without saying so.",
    "Added leagues have a **nationalities** panel now. Name the nations you want and give each one a number. The numbers are relative, so percentages, squad counts or whatever else you find easier all work, and the share beside each row is what you'll actually get.",
    "Watch that share, because a real league's breakdown copied off a website tends to add up to well over 100. The Turkish one I used came to 130.7%, and the game normalizes whatever you type, so asking for 48% Turkish hands you 36.7% instead. The panel shows you that as you type it.",
    "Every youth intake the league produces comes from the same mix, not just your opening squads, so a league you set up as Dutch is still bringing through Dutch teenagers in season forty.",
    "**Rest of the world** is one row standing for everyone you didn't name, and it leans English, because it's built from how often each nation turns up in English football. The panel shows you which countries it'll mostly hand you. Name the nations you want if you want a league that genuinely isn't English.",
    "A roster file can carry the mix as a `nationalities` block, and loading one fills the panel in for you.",
    "England, Spain and the rest keep the real breakdowns they were built from; those stay as they are.",
  ],
};

export default entry;
