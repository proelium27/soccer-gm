import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-07-21",
  title: "Click a column header to sort it",
  items: [
    "A bunch of the tables around the game were stuck in one fixed order, which was annoying when you wanted to, say, find the youngest free agent or the club with the biggest wage bill. Now you can click a column header to sort by it, and click again to flip the direction (there's a little arrow showing which way it's going). I wired it up on the tables where it actually helps: the Transfers search, Free Agents, Incoming Talent, Incoming Offers, the Academy, the Loans pages, the league-wide finances table, the Standings (sort by GD, OVR, whatever you like, and the position number stays honest), and the God Mode roster editor. The Roster and Stat Leaders pages already had their own thing going, so I left those alone.",
  ],
};

export default entry;
