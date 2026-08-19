import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-18",
  title: "Every country has its own cup now",
  items: [
    "Every country runs a knockout cup alongside its league, and both divisions are in it: all 40 clubs, top flight and second tier drawn against each other. The Continental Cup was the only cup in the game until now, which left a second-division club with nothing at all to win, and left you with two trophies to chase instead of three.",
    "The draw is open. No seeds, no bracket. After each round the clubs still standing go back in the hat, get paired at random, and whoever comes out first plays at home. You find out who you've got when the round before it finishes, and the two best clubs in the country can meet in the first round.",
    "40 clubs doesn't divide into a knockout, so the 16 lowest-placed clubs from last season play a preliminary round first and everyone else enters after it. Then a round of 32, a round of 16, quarter-finals, semi-finals, and the final on matchday 36. None of those clash with a Continental Cup matchday, and the ties show up on your **Schedule** page next to your league games.",
    "Every tie is one match, with extra time if it's level at 90 and penalties if it's still level after that. A second-tier club can knock you out. Both divisions are measured against one shared baseline here rather than each club being graded against its own league, so a top-flight side really is the better team on paper, but one match is a small sample and that's all an upset needs. Over a test season across all eight countries, 9 of the 64 quarter-finalists came from the second division.",
    "One thing it doesn't do yet, and I'd rather say so than let you find out: **it doesn't pay you**. I built it with prize money per round, like the Continental Cup. Then I ran a 20-season dynasty with it and without it, and the extra money pushed the poorest clubs in two of my four test worlds into the red around season 19 or 20, where they'd been fine before. The weaker leagues run on thin margins, and a new trophy quietly breaking their books is not a trade I want. So the payouts are off until I've tuned them properly. The cup itself is unaffected, and with them off it can't disturb anything else in your save.",
    "This is also the third leg of the treble. Win your league, the Continental Cup and your domestic cup in the same season and your **Club History** page records it. While I was in there I fixed something older: cup wins now show as trophy pills on a player's profile, which they never did before, the Continental Cup included.",
    "Where things are: a new **Domestic Cup** page in the sidebar, showing your country by default with a dropdown for any other country and for past seasons; a **Domestic Cup** tab on a player's profile for his cup stats; and the trophy case on Club History. If you reach the final, simming stops just before it, same as the Continental Cup final.",
    "A note for saves already in progress. A cup needs the whole season's matchdays to fit into, so an existing save picks one up at its next offseason rather than halfway through a season. New saves have one from season one, since nothing has to qualify for it.",
  ],
};

export default entry;
