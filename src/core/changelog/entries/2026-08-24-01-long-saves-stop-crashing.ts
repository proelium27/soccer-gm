import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-24",
  title: "Fixed the crash on big worlds",
  items: [
    "Someone sent me a save that kept crashing on their phone, 60 seasons deep. Having the actual file made all the difference, because the cause wasn't what I'd have guessed.",
    "Every time you sim, the game hands your whole save to a background worker so the page doesn't freeze, then takes the whole thing back. Their save was **222 MB** by the end of a season, and one advance was shoving that back and forth. Four copies of it end up in memory at once. A phone gives up and kills the tab.",
    "The biggest thing in there was match reports. Every game played this season keeps its full box score, every player's line and all 181 events of the timeline, about 16 KB a match. Across 16 divisions that's 6,080 matches a season, and by the last matchday it was **99 MB of match reports alone**. The worker doesn't get them any more. It never actually read them, apart from one spot at the end of the season, and it works that one out from a summary instead. The retiree archive and the power rankings history get held back the same way.",
    "Worth knowing: this was never about how long you'd been playing. Match reports get cleared every offseason and pile straight back up, so what actually matters is how big your world is and how far into the season you are.",
    "On their save, at the last matchday of a season: **222 MB down to 99 MB, and the copy from 4.8 seconds to 1.2.** It's flat across the season now too, so the end of a season costs no more than the start.",
    "Nothing is lost. Match reports are still there, still in your save, still on the Box Score page. They just stay put instead of going on a round trip they were never needed for.",
    "One smaller thing while I was in here: power rankings are snapshotted four times a season instead of eight, since each one is a row for every club in the world and they're kept forever. You'll see a shorter dropdown of past points in a season on the Power Rankings page. Snapshots you already have are left alone.",
    "I'll be straight that a save this old is still big, and this doesn't make it small. It roughly halves the heaviest thing it does, which should be the difference between crashing and not. There's more to claw back and I'll keep going.",
    "Nothing about how your league plays has changed. The results are identical.",
  ],
};

export default entry;
