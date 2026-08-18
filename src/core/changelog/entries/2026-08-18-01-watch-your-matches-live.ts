import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-18",
  title: "Watch your matches play out",
  items: [
    "There's a new **Watch Next Game** button on the dashboard, next to Sim One Game, and in the Sim menu at the top of every page. Instead of handing you the result it plays your club's match out a minute at a time: the clock runs, chances come and go, the feed fills in underneath, and the rest of your division's scores land on the right as they happen. The table beside them moves as they do.",
    "You can pause, run it at 1x, 2x or 4x, or skip straight to the final whistle. Half time gets its own pause. The **Every chance** switch controls how much detail you get: on, you see every shot; off, it's just goals, cards, substitutions, penalties and injuries.",
    "The match is simulated the moment you press the button, so what you're watching is the recording of it, and watching can't change the result. It also means nothing is saved until you close the viewer. Quit halfway through and the matchday hasn't happened yet, and playing it again gives you the same match back.",
    "**Cup ties work too.** Continental Cup rounds are played on league matchdays, so on one of those you've got two matches on the same day. Rather than sit you through both, or quietly pick one for you, the game asks which you want to watch, and plays both regardless, so the one you skip still has its box score waiting. A league-phase night shows the Swiss table beside the match instead of your league table, and a two-legged quarter-final or semi-final is watched one leg at a time, the second leg at the other club's ground where it's actually played.",
    "You can also rewatch anything you've already played. Open a match's box score and hit **Watch it back**.",
    "Two things it doesn't do yet. You can't make substitutions while you watch, which is the reason the matchday isn't saved until you're done: I built it that way so in-match changes can be added later without unpicking any of this. And possession and xG only show up at full time, in the box score, because the match record doesn't track either one minute by minute, and I'd rather leave a number out than show you one I'm making up.",
  ],
};

export default entry;
