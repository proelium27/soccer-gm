import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-16",
  title: "List a player for loan from the Roster page",
  items: [
    "There's a List for Loan button on the Roster page now, sitting next to List for Transfer in each player's pitch popover and in his XI or bench row. It lists him for a one season loan straight away, and clicking it again withdraws the listing. I kept the duration picker on the Loans page, so head there if you want to send someone out for two or three seasons instead.",
    "It's the same listing either way, so a player you list from the Roster page shows up under Your Loan Listings on the Loans page, and offers come in exactly as they always did. The button is greyed out when the transfer window is shut, and also when loaning him out would leave you too thin at his position, which is the same depth floor that stops you releasing your last cover somewhere.",
  ],
};

export default entry;
