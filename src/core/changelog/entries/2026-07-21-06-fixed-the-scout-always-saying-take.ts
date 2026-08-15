import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-07-21",
  title: "Fixed the scout always saying \"take it\" on incoming offers",
  items: [
    "Someone pointed out that the scout's one-line take on Incoming Offers said \"that's a great deal, take it!\" on basically every offer, which made it useless. Turned out I was comparing the offer to what the player's worth to your own club, but the buyers only ever make an offer that already clears that number, so of course it always looked like a great deal.",
    "Now the scout weighs the offer against the player's open-market value instead, so the take actually varies: a genuinely big offer gets a \"take it,\" a middling one gets a suggested counter price, and a lowball gets brushed off. Same as before, how reliable the read is still tracks your scouting spend, so a stingy scouting budget gives you a fuzzier take.",
  ],
};

export default entry;
