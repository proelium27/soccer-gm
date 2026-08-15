import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-07-25",
  title: "Long saves are a lot faster, and a lot smaller",
  items: [
    "Separately from the transfers freeze above, saves were getting enormous, and the game rewrites the entire save every single time anything happens in it. By season 14 that file was 88 MB and writing it took seconds, which made everything feel sluggish the longer you played.",
    "Two things were bloating it. First, every Continental Cup league-phase match was keeping a full per-player stat sheet forever, even though literally nothing in the game ever displayed them. That was 17% of your save doing absolutely nothing. Those are gone and you won't notice a single difference, all the scorelines and tables and knockout stats are still there.",
    "Second, and this is the real one: free agents never went away. Ever. Every washed-out academy kid who nobody signed just sat in your save forever, and by season 14 there were 9,245 of them against only 5,996 players actually on teams. 96% of them had never even reached 55 overall. So now, once a free agent is 24 or older, has never been any good, and isn't projected to become good, he's permanently deleted. Anyone under 24 is safe, anyone with real potential is safe, and any former star who's declined is safe, so your incoming talent list and the useful end of free agency are untouched.",
    "Result: that 88 MB save drops to 49 MB, and the slowest thing the game does got about 11 times faster. The pool now settles at a stable size instead of climbing forever, so it shouldn't creep back.",
    "Two honest warnings. This permanently deletes those players from your existing save the first time you load it, and I can't undo that, so if you had a sentimental attachment to a 44-overall 31-year-old free agent, I'm sorry. And while I was in here I found a genuinely nasty old bug: because of how new players got their ID numbers, a newly generated player could occasionally inherit a deleted player's entire transfer history. That's fixed properly now.",
    "Last thing, and this one's a genuine bug fix I stumbled into. Cup stats on player profiles were badly wrong, and had been forever. The Continental Cup has three stages (the league phase, the playoff, then the knockouts) and the code that built a player's Cup tab was only ever looking at the knockout ties. So if your club played all six league-phase games and went out in the playoff, every single one of your players showed zero cup appearances. Even if you made the quarter-finals, your six group games didn't count. In one season I checked, players had played 1,857 cup games between them and the profiles were showing 199 of them.",
    "That's fixed: cup stats now count every stage. Your players' cup appearances and goals will jump, in some cases a lot, and that's them finally being counted properly rather than anything being inflated. Old seasons are corrected too, because I fold the numbers up before throwing the detailed match data away (which is also how the cup history got about eight times smaller).",
  ],
};

export default entry;
