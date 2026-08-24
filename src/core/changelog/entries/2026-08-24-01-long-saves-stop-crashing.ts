import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-24",
  title: "Fixed the crash on big worlds",
  items: [
    "Someone sent me a save that kept crashing on their phone. They were right, and once I had the actual file the cause turned out to be something I'd have never guessed from the outside.",
    "Every time you sim, the game hands your whole save to a background worker so the page doesn't freeze, then takes the whole thing back. The heaviest thing in that save is the match reports. Every game played this season keeps its full box score, every player's line and all 181 events of the timeline, about 17 KB a match. On their world, which had 32 divisions, that's 12,160 matches a season. By the end of a season **88% of the save was match reports**, and one advance was shoving 232 MB back and forth. That's what kills the tab.",
    "The important part: this has nothing to do with how long you've been playing. Match reports get cleared every offseason and pile straight back up. It's how *big your world is* and how far into the season you are. A 32-division world was hitting it in its first season.",
    "So the worker doesn't get them any more. It never actually read them, apart from one spot at the end of the season, and it works out that one from a summary instead. On the save they sent me, at the last matchday of a season: **216 MB down to 27 MB, and the copy went from 3.8 seconds to a quarter of a second.** It's also flat now, so the end of a season costs no more than the start.",
    "Nothing is lost. Match reports are still there, still in your save, still on the Box Score page. They just stay put instead of going on a round trip they were never needed for.",
    "Two smaller things while I was in here. The retiree archive and the power rankings history get held back the same way, worth another 31 MB on a long save. And power rankings are snapshotted four times a season instead of eight, since each one is a row for every club in the world and they're kept forever. You'll see a shorter dropdown of past points in a season on the Power Rankings page. Snapshots you already have are left alone.",
    "Nothing about how your league plays has changed. The results are identical.",
  ],
};

export default entry;
