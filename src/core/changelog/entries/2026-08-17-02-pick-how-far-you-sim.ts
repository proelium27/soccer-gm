import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-17",
  title: "You pick how far you sim now",
  items: [
    "**Sim to End of Month** and **Sim to Transfer Deadline** are gone. In their place there's a box: pick **sim to matchday** and type a number, or switch it to **sim this many matchdays** and type how many. It's on the Dashboard and in the Sim menu in the top bar, next to the two buttons that stay (one game, and the rest of the season).",
    "Those two old buttons were the only distances the game let you ask for, and neither was usually the one you wanted. If your club had a cup tie on matchday 30 there was no way to stop on 29. If you wanted six weeks rather than one month, tough. Now you say where you want to stop.",
    "Under the box is a line telling you exactly what you're about to play before you play it: which matchdays, how many that is, and the month it ends in. It also warns you when the run would take you through **deadline day**, since that's the one matchday with a consequence beyond the result — the winter transfer window shuts at the end of it. Simming to matchday 21 leaves you standing on deadline day with the window still open, which is what the old deadline button did.",
  ],
};

export default entry;
