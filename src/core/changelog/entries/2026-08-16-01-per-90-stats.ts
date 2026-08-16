import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-16",
  title: "Per 90 stats",
  items: [
    "Stat Leaders and the season stats on a player's profile both have a Totals / Per 90 toggle. Per 90 divides each counting stat by the number of full matches a player's minutes add up to, so a squad player is comparable to someone who starts every week: a striker with nine goals in eight hundred minutes rates above one with fourteen in a full season, which raw totals can never show. Minutes were already recorded for every appearance, so this covers every season already on record, including seasons played before the toggle existed.",
    "Appearances, minutes and match rating stay as they are in per-90 mode. The first two are what the rate is calculated from, and a match rating is already an average, so dividing it by anything would be meaningless. The Match Rating and Minutes entries in the stat dropdown disable the toggle for the same reason.",
    "The Stat Leaders board requires thirty percent of the minutes available so far to appear in per-90 mode, and says so above the table. Without a floor the board belongs permanently to whoever scored in a twelve-minute cameo, which reads as 7.5 goals per 90. The floor is measured in minutes rather than appearances, because twenty appearances off the bench is exactly the case an appearance count would let through. It scales with the season's progress, so the board is meaningful in September as well as in May.",
    "A player's own profile has no such floor, since a single player's page is not a ranking and a short season reading high there is information rather than a false leader. The profile's Cup tab carries the toggle too. National team stats do not, because caps are recorded without minutes and so have no per-90 reading.",
  ],
};

export default entry;
