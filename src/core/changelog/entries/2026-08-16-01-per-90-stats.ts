import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-16",
  title: "Per 90 stats",
  items: [
    "Stat Leaders and the season stats on a player's profile now have a Totals / Per 90 switch. Totals only ever told you who played the most, which is why the goals board is the same eleven strikers every year. Per 90 divides each stat by the number of full matches a player's minutes add up to, so you can see who is actually producing while he's on the pitch. The first world I tried it on had a striker sitting third in the league at 0.63 goals per 90 off 1,421 minutes, a player who was nowhere near the top of the goals table and who I would never have looked at twice.",
    "Minutes have been recorded for every appearance since box scores went in, so I didn't have to add anything to make this work. Every season already in your save has it, including ones you played months ago.",
    "The leaderboard makes a player reach 30% of the minutes available so far before he shows up, and tells you what that number is. Without a floor the board belongs permanently to whoever came on for twelve minutes and scored, because that reads as 7.5 goals per 90 and nothing beats it. The floor counts minutes rather than appearances on purpose: twenty run-outs off the bench is exactly the player an appearance count would let through, and he's the one the floor exists to stop.",
    "Your own player's page has no floor, since one player's page isn't a ranking and a short season reading high there is worth knowing. Appearances, minutes and match rating stay as totals wherever you are, because the first two are what the rate is worked out from and a match rating is already an average. The Cup tab has the switch too. National team stats don't, and won't: caps are recorded without minutes, so there's nothing to divide by.",
  ],
};

export default entry;
