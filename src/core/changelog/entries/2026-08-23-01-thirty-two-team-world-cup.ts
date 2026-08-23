import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-23",
  title: "The World Cup is 32 teams now",
  items: [
    "The World Cup field goes from 16 nations to 32, so the tournament you click through in the summer is about twice as long:",
    [
      "- Eight groups of four, instead of four.",
      "- Top two out of each still go through.",
      "- Which gives you a **round of 16**, a whole extra knockout round before the quarter-finals. It has its own button on the Dashboard.",
    ].join("\n"),
    "The world finally got big enough to hold it. With 16 leagues generating players, 44 nations now have a deep enough pool to field a squad, and the 32nd best of those is still a real team, somewhere around the level of Ukraine or the USA. A 40-team field would have started scraping.",
    "The trade, and I don't love it: qualifying means less than it did. When 16 got in, 28 nations could miss out. At 32 it's 12, and they're all European or African. South America, Asia and North America now send everyone they have and play no qualifying matches at all, which you'll see as empty space on the Qualifying page. The way to get that back is a bigger world rather than a smaller World Cup. More countries with leagues means more nations with enough players to enter.",
    "I fixed a bracket bug while I was in there. The two nations coming out of the same group were landing in the same half of the draw, so they'd meet again two rounds later instead of only in the final. Real brackets keep them apart, and now these do too. It changes results in the confederation cups as well, since they use the same bracket.",
    "If you're mid-World-Cup when you load this, that tournament finishes at the size it was drawn: 16 nations, three rounds. The next one is 32.",
  ],
};

export default entry;
