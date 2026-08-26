import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-23",
  title: "The green highlight on the national team pages is fixed",
  items: [
    "Rows on the National Teams pages were marked with a pale mint block: the nations through from a group, and the eleven a nation would field on the Rosters page. That colour came straight out of Bootstrap's defaults and I never themed it along with the rest of the game, so it sat on the dark pages as a bright slab, and the player names inside it stayed green on a near-white background, which made them hard to read.",
    "Those rows now get a soft green tint plus a green bar down the left edge, the same edge marker the league table uses for a Cup place.",
    "Two other bits of stock Bootstrap while I was in there. The selected nation on Rosters and the selected club on the New League screen were filled in Bootstrap blue, and they're green now like everything else that's selected. Same for the Players / National teams switch on the international Stat Leaders page.",
  ],
};

export default entry;
