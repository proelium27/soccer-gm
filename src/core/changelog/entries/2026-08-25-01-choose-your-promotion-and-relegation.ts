import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-25",
  title: "Set how many clubs go up and down in a league you add",
  items: [
    "A league you add in **World setup** was stuck with three up and three down. It has an **up and down** box now, next to the ones for its divisions and their size: anything from none at all up to six.",
    "Set it to none and its two divisions never mix. Win the second one and you stay in it, finish bottom of the top one and you stay there too. Bigger numbers churn its top flight every summer, so staying up is real work and a promotion push takes fewer good seasons.",
    "Half the division is the cap, since promoting six out of an eight-club division is just the two divisions trading places.",
    "England, Spain and the rest of the shipped countries still play three up, three down, and so does any league you add and don't touch.",
  ],
};

export default entry;
