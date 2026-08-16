import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-16",
  title: "The stats table on a player's page was off by a column",
  items: [
    "The season stats table on a player's profile had a Saves heading with no Saves value under it, so everything to the right of it was sitting one column too far left. Tackles were showing under Saves, interceptions under Goals Against, and so on to the end of the row. The numbers were all real, they were just filed under the wrong headings. It has been wrong for a while and I only caught it when adding card columns pushed the shift far enough right to be obvious.",
    "While fixing it I moved the whole stats box down to the bottom of the page and gave it the full width, instead of squeezing it into the right-hand column next to the charts. It was running out of room at sixteen columns, and this gives it somewhere to grow. The OVR / POT / attribute history table moved down with it for the same reason, since on a smaller laptop screen its right-hand columns were getting cut off.",
    "The attribute history's column headings are also readable now. They were built by taking the first letter of each attribute name, which meant Speed, Strength and Stamina were three columns all headed S, next to each other, and you had to hover each one to find out which was which. They now read SPD, STR, STA and so on.",
    "One smaller thing: saves, goals against and expected goals against now stay blank for outfielders on this page rather than saves alone showing a hard 0. They are keeper columns, and a zero there was just noise.",
  ],
};

export default entry;
