import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-07-27",
  title: "All-time single-season leaderboards let a player show up twice",
  items: [
    "Small fix on Stat Leaders. If you set the season dropdown to All Seasons and then picked Single Season, it was only ever showing each player's own best year, one row per player. So if the same striker had the two best scoring seasons in your league's history, you'd only ever see one of them, and the actual second-best season in the record book was hidden behind him.",
    "Now every season a player recorded is its own row, so those two years sit next to each other at the top where they belong, and the board reads like a proper all-time list. There's a Season column so you can tell which year each line is. Career totals are unchanged, one row per player as before.",
  ],
};

export default entry;
