import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-25",
  title: "The rest of the crash fix",
  items: [
    "Yesterday got that 60-season save down from 222 MB to 99 MB every time you sim, and I said there was more to claw back. This is the rest of it. It's at **46 MB** now.",
    "The next biggest thing was careers. Every player carries every season he's played, his stat line and his ratings for all of them. On that save that's **45 MB of career history against 4.5 MB of actual players**, and it grows every season you play. But the sim doesn't need a striker's whole life story to play Saturday's match, it needs the last couple of years. So every player now keeps a running summary of his career, and only the recent detail makes the trip.",
    "That summary turned out to be worth having for its own sake. The all-time leaderboards, the retiree archive and the career milestones in the news feed all used to read a player's entire history just to add up a total. Now they read the total.",
    "The news feed, the archived cups and the transfer log went the same way. That save has **186,000 transfers** in it, and the sim only ever looks at the last few seasons of them, because the only thing it wants to know is who has just moved.",
    "Same caveat as yesterday. This doesn't make a big save small, and on disk it's the same save it always was. What it does is cut what has to be copied every single time you sim, which is the thing that was actually killing tabs.",
    "Nothing is lost and nothing about how your league plays has changed. The results are identical.",
  ],
};

export default entry;
