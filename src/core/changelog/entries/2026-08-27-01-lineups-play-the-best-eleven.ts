import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-27",
  title: "Lineups stop starting a bad specialist ahead of much better cover",
  items: [
    "When the game picked a lineup it sorted by position label first and rating second, so any recognised full-back beat anyone who wasn't one, however far behind he was. First-division clubs were starting **39-rated full-backs with 67-rated midfielders on the bench**. That was **16.9% of every starting slot** in the top divisions, at **77% of clubs**.",
    "The match engine only charges about six rating points for covering a nearby position, and it already chose substitutes on that basis. I never gave the lineup picker the same rule, so it was dodging a small cost by paying a much bigger one.",
    "It now works out what each player would be rated in the job he'd actually be doing, takes off what covering it costs him, and starts the eleven worth most. Average first-division starters went up wherever natural cover was thin: **wingers 56.9 to 65.9**, **central midfielders 64.6 to 70.0**, **strikers 64.5 to 68.1**, **full-backs 60.8 to 64.1**. Starters rated under 50 fell from **20.1% to 11.7%**.",
    "Formations get chosen the same way now, so a squad with three central midfielders and no holding player lines up 4-5-1 instead of playing 4-3-3 with one of them shoved into a job he doesn't do.",
    "Your own club sees this through **Best XI**, the reset after you change formation, and the fallback when your saved lineup goes stale. A specialist still keeps his place when the gap is smaller than the cost of moving someone across, and a player with a real second position pays nothing at all to fill it.",
    "Some clubs are still short, and I know why. A club with one excellent centre-back and three poor ones doesn't count as needing a centre-back, because the check only looks at its best player in each position. So the transfer market never offers it one, and it can sit on **£125M** and start a 16-year-old. That's most of the one-in-eight first-division starters still rated under 50. Fixing it means changing how clubs judge their own squads, and since nearly every transfer runs through that check I want to test it against the smaller leagues' finances before it ships.",
  ],
};

export default entry;
