import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-20",
  title: "A download button for real rosters",
  items: [
    "The **Leagues** page has a Download Real Rosters button on it now. It gets you a roster file covering all sixteen leagues, and you load it back with **Import** to start a league with real clubs and squads in place of the fictional ones.",
    "The game still generates its own fictional clubs by default and that hasn't changed. Real clubs and real players have always been something you bring yourself in a roster file, and the file is a separate download rather than part of the game. What's new is that you don't have to build one first.",
    "The best players in the file read around 80 rather than 90. Ratings are rescaled onto the spread this game is tuned for, so the ordering and the gaps between players carry over while the absolute numbers stay on our scale. 90+ is still something you only see after a player has progressed into it.",
    "Imported clubs don't show a crest. A crest belongs to a team slot rather than a club name, so an imported club would otherwise wear the badge of whichever fictional club it replaced. Colors do carry over.",
  ],
};

export default entry;
