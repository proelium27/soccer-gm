import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-17",
  title: "Difficulty levels",
  items: [
    "You now pick a difficulty when you create a league: **Easy**, **Normal**, **Hard** or **Brutal**. It's fixed for that save, so it's set on the New League screen and nowhere else. Normal is the game exactly as it has always been tuned, and every save you already have is on it, so nothing about a dynasty in progress changes.",
    "The thing I care most about here is what difficulty *doesn't* touch. It never changes the world. AI clubs buy and sell each other's players at the same prices on Brutal as on Easy, their academies produce the same players, and the leagues stay exactly as strong as they otherwise would. I checked this rather than assuming it: there's a test that pins the AI transfer market's behaviour as identical on all four levels, because the alternative was a difficulty setting that quietly rearranged the whole economy. The weaker leagues in particular live off transfer receipts, and I've bankrupted Belgium once already by throttling deal flow for what looked like an unrelated reason.",
    "Four things change, all of them about your club. Your income and how much you can bank go up or down. Your youth intake comes through stronger or weaker. Asking prices are marked up or down when you're the one buying, though not when you're selling. And the net that keeps the best players at the best clubs off the market is cast wider for you, so on Hard and Brutal a lot of the game's best players simply aren't available and you have to develop your own instead. Scouting is fuzzier too: potential bands are wider and take longer to sharpen.",
    "When a player is out of reach because of your difficulty, the game says \"not available to you\" instead of claiming his club won't sell. That wording is deliberate. His club might well sell him, just not to you, and you may watch exactly that happen. I'd rather the game be straight with you about which of those two things is going on.",
    "**You can go broke, and on Brutal you probably will.** Wages cost you the same as they cost everyone else, which is the part that does the damage: a thirty-man squad averaging 75 OVR runs a wage bill of about £88M a season, which is roughly the whole base income of a top-flight club on Normal, and about £18M more than you earn on Hard. So it isn't the start that gets you, it's the squad you build. Go negative and you can't sign anyone until you're positive again, and your scouting sits at zero while you're overdrawn, so your read on potential gets worse at exactly the moment you need to sell well. There's no debt system and nobody bails you out. You get out by selling someone.",
  ],
};

export default entry;
