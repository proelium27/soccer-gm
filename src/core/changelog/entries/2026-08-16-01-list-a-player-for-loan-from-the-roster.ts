import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-16",
  title: "List a player for loan from the Roster page",
  items: [
    "You can send a player out on loan from the Roster page now, without going to the Loans page first. The List for Transfer button has turned into a List menu holding both listings, so it takes up the same room it always did: open it on any player, in his pitch popover or his XI or bench row, and you get List for transfer and List for loan (1 season). Clicking either again removes that listing. I kept the duration picker on the Loans page, so head there if you want to send someone out for two or three seasons instead.",
    "It's the same listing either way, so a player you list from the Roster page shows up under Your Loan Listings on the Loans page and offers come in exactly as they always did. If a listing isn't available the menu says why rather than hiding the option: loans need an open transfer window, and you can't loan away your last cover at a position, which is the same depth floor that stops you releasing him. A player who's listed for loan now carries an L on his pitch chip, next to where a transfer-listed player gets a $.",
  ],
};

export default entry;
