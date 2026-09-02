import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-31",
  title: "A watchlist, for the players you're keeping an eye on",
  items: [
    "There's a star beside every player's name now: on his profile, in the transfer search, and on the Free Agents and Incoming Talent lists. Click it and he goes on your **Watchlist**, which is a new page under Team in the sidebar.",
    "It's a shortlist and nothing else. Watching a player doesn't scout him, doesn't tell his club anything, and doesn't change what he costs. I wanted somewhere to park the names you notice in October so they're still there when the window opens in January.",
    "Each one shows up with his club and league, what he's done this season (appearances, goals, assists, average match rating), his wage, when his contract runs out, what your scouts reckon he's worth, and whether his club would take an offer at all. That last column runs the same checks the transfer search does, so if it says his club won't sell their star, an offer really would bounce.",
    "Nothing gets frozen when you click the star. His club, his rating and his price are all worked out fresh every time you open the page, so a name you starred three seasons ago shows the club he's at now at what he'd cost now.",
    "Players come off the list on their own when they retire, since there's no profile page left to un-star them from.",
  ],
};

export default entry;
