import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-24",
  title: "Qualifying tells you what each confederation is playing for",
  items: [
    "The Qualifying page never said how many nations go through from where, so a group table was a column of points with no stakes attached. Each confederation now gets a line above its groups:",
    "**Europe.** 17 of the 32 places, from five groups: every group's top three, plus the two best fourth-placed nations.",
    "All of that is fixed the moment the campaign is drawn, three offseasons before the last round is played, so it's on the page from before the first match. In the group tables a solid bar down the left marks a place that qualifies outright, and a fainter one marks a place that's still in the running for whatever's left over.",
    "How many go through from your group isn't fixed, which I don't think the page made clear at all before. The group winner always qualifies. After that, the runners-up from every group in the confederation get ranked against each other for the places that are left, so a strong runner-up goes through while a weaker one in the next group misses out.",
    "The confederations that play no qualifying at all, because they have no more nations than places, used to be missing from the page completely. Their nations just turned up in the qualified list from nowhere. They're listed now with a line saying everyone's through.",
    "Past campaigns still only show who qualified. The summaries they get collapsed into don't keep the nation list the split is worked out from, and once the qualifiers are known that's the better answer anyway.",
  ],
};

export default entry;
