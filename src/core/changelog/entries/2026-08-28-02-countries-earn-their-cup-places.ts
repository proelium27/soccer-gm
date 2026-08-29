import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-28",
  title: "Countries earn their Continental Cup places now",
  items: [
    "How many clubs your country sends to the Continental Cup was fixed forever. England, Spain, Italy and Germany sent four, everyone else sent two, and twenty seasons of Portuguese clubs winning everything changed nothing about it. Now the places are handed out on a **country coefficient**: a rolling record, over the last five seasons, of how that country's clubs have actually done in Europe. Winning matches counts, going deep counts for more, and it's divided by how many clubs you sent, so sending four isn't worth anything on its own. Both competitions count.",
    "Places are **moved, never created**. The Cup always fields exactly 24 clubs, so for one country to gain a place another has to lose one, and no country can be cut below a single place. A country with nobody in Europe would have no way to earn its way back, and a one-way trapdoor isn't a mechanic, it's a bug you have to live with for the rest of the save.",
    "Nothing moves until a save has **three seasons** of continental results behind it. I had it reallocating from the first available season and it did something silly: in year three it handed Belgium four places and dropped Germany to two, off one season, then put it all back the year after. A world's first cups are the noisiest data it will ever have.",
    "You can see the whole table on the **Continental Cup** page: every country, its coefficient, and how many places that earns it.",
    "Setting expectations, because I'd rather say it than have you think it's broken: on a normal save the big four usually keep their four places, and they should, because they really are stronger and they keep earning them. Over twenty seasons of testing the allocation moved a couple of times and settled back. Where this matters is the long game. Take Portugal or Turkey, win things with them for a decade, and the places follow you.",
  ],
};

export default entry;
