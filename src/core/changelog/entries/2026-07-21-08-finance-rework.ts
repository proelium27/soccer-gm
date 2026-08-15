import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-07-21",
  title: "Finance rework",
  items: [
    "A lot of AI clubs were just sitting on piles of cash and never buying anyone, which isn't how a real manager thinks. The reason was the market only ever did a deal if the player was a straight up bargain for the buyer, so decent-but-fairly-priced players never moved.",
    "So now if a club has real money to spend and an actual gap on its roster (either it's short of bodies at a position, or its best guy there is a clear weak spot), it'll pay a fair price to fill that hole instead of holding out for a steal. It'll also dig a bit deeper into its cash to get the deal done. It still keeps a reserve so nobody bankrupts themselves.",
    "While I was in there I also tightened the money supply. Clubs were swimming in cash because the base allocation every club gets each season was way more than they could ever spend, so it just piled up. I cut that base allocation from $110M to $88M across the board (second division too, scaled the same way).",
  ],
};

export default entry;
