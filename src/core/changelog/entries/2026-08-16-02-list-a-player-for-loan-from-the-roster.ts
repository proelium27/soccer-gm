import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-16",
  title: "List a player for loan from the Roster page",
  items: [
    "You can list a player for loan straight from the Roster page now. Loans only lived on the Loans page before, which was the wrong place for them: you work out that a kid is never going to play while you are looking at your bench, and then you had to go somewhere else to do anything about it.",
    "Rather than add a second button to a row that already has Extend, More minutes and Release on it, I turned List for Transfer into a List menu holding both. Open it on any player, in his pitch popover or his XI or bench row, and you get List for transfer and List for loan (1 season). Clicking either again takes that listing back off. The duration picker stays on the Loans page, so go there if you want to send someone out for two or three seasons instead.",
    "It is the same listing either way, so a player you list from the Roster page turns up under Your Loan Listings on the Loans page and offers come in exactly as they always did. When a listing is not available the menu says why instead of hiding the option: loans need an open transfer window, and you cannot loan away your last cover at a position, which is the same depth floor that stops you releasing him. A player listed for loan now carries an L on his pitch chip, next to where a transfer-listed player gets a $.",
  ],
};

export default entry;
