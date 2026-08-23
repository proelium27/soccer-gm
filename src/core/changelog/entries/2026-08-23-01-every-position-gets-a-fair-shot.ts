import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-23",
  title: "Every position gets a fair shot at being your best player",
  items: [
    "OVR is a weighted blend of a player's 14 ratings, and every position weights them differently. What I never checked is that the two halves of that pull the same way: a position's OVR leans hardest on the skills it is also generated best at, so the two stacked. Strikers came out of a new world averaging 55.9 OVR against a full back's 49.4, and that six-point gap came from the formula rather than from anything about football.",
    "You could see it on the club pages. In a freshly generated world of 320 clubs, **132 had a striker as their best player and exactly one had a full back**. Six had a central midfielder. Going by squad make-up those three should have been around 38, 51 and 51.",
    "Every position now lands on the same average OVR and the same spread, so a 78 means the same thing wherever a player stands. The same 320 clubs now break down as 35 led by a striker, 61 by a full back and 39 by a central midfielder.",
    "Goalkeepers needed a second fix. Over half a keeper's OVR rides on one rating, so his number swings further than anyone else's in both directions, and once the averages were level he took over the top of the lists instead: 103 clubs out of 320. Keepers now vary a little less from one to the next, which puts them back in line. It doesn't change how they play, since shot-stopping is still judged on the goalkeeping rating alone at full strength.",
    "The world hasn't got better or worse. The average OVR across every player is exactly where it was, so wages, transfer values and the thresholds behind things like division-two moves and untouchable stars all still mean what they did. Your full backs and midfielders read a few points higher, your strikers and keepers a few points lower.",
    "Which players hold a second position shifts too, because that badge compares a player's rating at one position against another and those comparisons were carrying the same bias. Career position changes were flowing the wrong way for the same reason: a good full back rated higher as a winger on the formula alone, so the game kept converting them. That's gone.",
    "Existing saves pick this up the moment you load them, including the OVR history on every player's career page, so a chart reads on one scale end to end instead of stepping at the season this shipped. The goalkeeper half applies when players are generated, though, so an existing world keeps its old spread there and only a new save gets it.",
  ],
};

export default entry;
