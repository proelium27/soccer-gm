import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-19",
  title: "Your players have a continental championship to win",
  items: [
    "National teams now play a continental championship in the middle of the World Cup cycle, two years either side of it, in the same summer as that year's qualifying round. Europe plays the European Championship, South America Copa América, Africa the Africa Cup of Nations.",
    "You click through them the way you already click through a World Cup: one button for every championship's group stage, then one per knockout round. They run side by side rather than one after another, and a smaller tournament waits for a bigger one to catch up, so every final lands on the same click. \"Sim through the championships\" and the skip button behave exactly as they do for the World Cup.",
    "There's no separate qualifying for them. Each confederation takes its strongest nations at the time of the draw, which is the order you already see on Power Rankings. Giving every continent its own qualifying campaign would have added hundreds of fixtures a cycle, and I'd rather spend that on the tournaments themselves.",
    "How big a championship is depends on how many nations its confederation can actually field. Europe fills a 16-nation field: four groups, then a quarter-final. A confederation with only a handful of football nations plays a single group and sends its top two straight to the final, which is how Copa América was really played until 1975.",
    "You'll usually see three of them. The Asian Cup, Gold Cup and OFC Nations Cup are built too, and stay dark, because a default world doesn't have four national teams' worth of players from those confederations. Almost everyone is born into one of the eight countries whose leagues you play in, so the rest of the world is thin. Fill it out, with an imported roster say, and those championships start being played on their own.",
    "Winning one counts for the Ballon d'Or. Roughly nine league goals to a striker, which puts it above your domestic cup and below your league title, with the Continental Cup a bit above that and the World Cup above everything. Goals and caps at a championship are worth half again what a qualifier is worth; a World Cup is still worth double.",
    "Continental titles are counted separately from World Cups on a player's profile, so winning the Euro doesn't read as winning the World Cup.",
    "Building this turned up a Ballon d'Or bug that was already in there: it only ever read the **first** international campaign a player had on record for a season. Nobody could have two, so it never bit. A continental summer gives a player both a qualifying round and a championship, and one of them would have been dropped silently. It adds them all up now.",
  ],
};

export default entry;
