import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-27",
  title: "More ways to search the transfer market",
  items: [
    "The transfer market had five filters: position, min overall, min potential, max age and max value. That's enough to browse with, not enough to look for something specific. Both panels on the Transfers page have a proper filter bar now.",
    "You can filter by nationality, by which league he plays in, and by a weekly wage ceiling. The nationality list is built from the countries that actually exist in your save rather than a fixed list, and the wage one is there because the fee is only half of what a signing costs you.",
    "There's a contract filter too: expiring now, a year left, two, three. That's the cheap end of the market and there was no way to find it.",
    "Overall, potential, age and scout value are ranges instead of one-sided, so you can ask for a 70 to 78 centre-back aged 21 to 25 rather than everything above 70 and a lot of scrolling.",
    "The world search has a tick box for only showing players you can actually bid on. Without it the top of the list fills up with players whose clubs won't sell, which is honest but wastes most of the 60 rows you get.",
    "Every column heading sorts now, on both tables, and the money boxes take shorthand: `50m`, `2.5m` and `800k` all work.",
    "These re-run the search rather than hiding rows from a list that was already picked, same as the old filters did. Setting one genuinely goes and looks again.",
  ],
};

export default entry;
