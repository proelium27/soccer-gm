import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-20",
  title: "Trebles count, and they count for a lot",
  items: [
    "The trophy cabinet on **Frivolities** has a Trebles column now, counting the seasons a club won its top flight, the Continental Cup and its domestic cup all at once. It doesn't add to the Total Trophies column beside it, because that column counts trophies and a treble isn't a fourth one, it's the same three won together.",
    "The club **GOAT** board treats it the other way round, on purpose. There a treble is worth a big bonus on top of the three trophies it's made of: those score 290 between them (100 for the league, 150 for the Continental Cup, 40 for the domestic cup) and the treble adds 150 more. So winning all three in one season is worth about half again what the same three trophies are worth spread across different years. The board has its own Trebles column, and expanding a club's row shows the bonus on its own line with the rest of the arithmetic.",
    "A cabinet is a count and a GOAT score is an argument, which is why they treat it differently. Counting a treble as an extra trophy would just be wrong, but rating a rare combination above the sum of its parts is the whole job of a ranking formula. Like every GOAT weight, that 150 is my taste and it lives in one constant, so it's easy to argue with.",
  ],
};

export default entry;
