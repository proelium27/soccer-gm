import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-07-22",
  title: "Free signings finally show up in a player's history",
  items: [
    "A few of you flagged a nasty one: sign a guy off the free agents or incoming talent page and he'd play for you fine (wages, appearances, all of it), but his profile would insist he was still at some club he'd left seasons ago, and he seemed to get bounced around between clubs for no reason. Turns out free-agent moves were never getting recorded anywhere, so the profile rebuilt each player's club-by-season history purely from paid transfers and just guessed wrong whenever a free move happened. About 1 in 5 players league-wide was showing the wrong current club because of it.",
    "Now every free signing gets logged like a real move (fee of zero, from \"Free agent\"), so his transfer history, his OVR chart's club colors, and the News Feed all line up with where he actually is. That includes signing a prospect straight into your academy, which was the version of this most of you were running into. Old saves can't be back-filled, so a player's history before this update may still be a little off, but everything from here on is correct.",
    "I left the routine AI free-agent shuffling out of the News Feed and the completed-transfers lists on purpose, it's over a thousand signings a season and would bury everything else. Your own free signings still show up there.",
    "While I was in there: the Roster page now flags anyone in the final year of his deal with a \"Final year\" badge and a banner, since nobody re-signs your players for you and it was too easy to let someone walk for free without noticing. The Academy page got the same warning, because academy stipends expire on exactly the same schedule and losing a prospect you'd developed for three seasons that way is worse.",
  ],
};

export default entry;
