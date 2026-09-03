import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-09-03",
  title: "The Finance page, rebuilt around when money moves",
  items: [
    "The Finance page had all the right numbers on it and told you almost nothing. Your balance was buried in a sentence. The cash flow table quietly covered two different seasons in one flat list of rows. And the thing that actually matters about club money here, that it moves at a handful of specific moments rather than trickling in, wasn't stated anywhere.",
    "So the middle of the page is now **Your money year**: the four moments money changes hands, in order, with a marker on the one you're sitting in. During the season, cup prize money lands the day you play the tie and transfer fees move when a deal closes. At season end, league prize money and hype revenue come in and your scouting bill goes out. In the offseason, any add-ons settle. Then the next season starts, the new allocation arrives, and your entire wage bill comes straight back out of it in one go.",
    "That last one is the bit worth knowing. Wages aren't spread across the season, they're taken in full on day one. It's why a squad you can just about afford in May can leave you broke in July.",
    "Across the top there are four figures instead of a paragraph: your balance, your wage bill as a share of what the club earns in a year, what you're on course to start next season with, and your hype.",
    "**Your savings ceiling is on the page for the first time.** Your club can only bank so much, it scales with your hype, and anything you'd have saved above that line was never being paid to you at all. That was already true and nothing told you. Now the balance shows how full the ceiling is, and if the projection runs past it you get told how much won't reach you, before it happens rather than after.",
    "While adding that I found the projection had been quietly wrong about it. It added the rows up without applying the ceiling, so a club near its cap was being shown money the offseason was about to destroy on arrival. It runs through the real settlement now, so the number you see is the number you get.",
    "Cup prize money moved into the timeline instead of having its own card, since it belongs to the during-the-season stage. Same figures, same round-by-round breakdown, just in the place where it makes sense.",
    "The wage table now tells you what share of the bill each player is taking, and the heading says what the whole thing is as a percentage of your income. The wall of scouting text is tucked behind a (?), with the two things scouting actually buys you left in plain sight.",
  ],
};

export default entry;
