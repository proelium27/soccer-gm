import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-15",
  title: "Seven more formations",
  items: [
    "There are sixteen formations in the dropdown now instead of nine. The new ones are 4-4-1-1, 4-3-2-1, 4-2-2-2, 3-4-2-1, 3-5-1-1, 5-2-3 and 5-2-1-2, and each of them fields a different mix of positions from anything already on the list, so they are all genuinely different elevens rather than the same team drawn differently. 4-2-2-2 plays two attacking mids behind two strikers, 4-3-2-1 puts two attacking mids behind a lone striker, 5-2-3 sits a back three behind two holding mids with a front three ahead.",
    "I left out some shapes you might expect to see. Your team's strength is built from the positions you field, and the game has no idea where on the pitch I have drawn them, so 4-1-4-1 uses exactly the same eleven positions as 4-3-3, and 4-2-4 the same as 4-4-2. Putting those in the list would have made it longer without changing a single thing about your team, so they are not there.",
    "AI clubs pick from the same sixteen. I checked four different worlds before shipping this, because the thing that would have gone wrong is one new shape turning out to suit how squads are stocked and getting picked by everybody. It went the other way: all sixteen get used in every world, and the most popular shape's share of clubs drops by four or five points each time. About a third of clubs line up differently than they used to, and the best eleven they can field goes up by around 0.15 to 0.2 of a rating point per starter, so this changes how teams look more than how good they are.",
  ],
};

export default entry;
