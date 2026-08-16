import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-16",
  title: "Cards get your players suspended now",
  items: [
    "Cards have been in the match engine for a long time, but they stopped mattering the moment the whistle went. Now they follow a player around. Five yellows across the league season and he misses the next match. Sent off for a second yellow, he misses one. Straight red, he misses three. If a sending-off and your fifth yellow land in the same game he serves the longer of the two rather than both, which is less true to life, but stacking them felt like a pile-on for something you have no say in and the difference was one match.",
    "Bans only cover league games. A suspended player is still available for the Continental Cup, and only league cards count toward one, which is how it works in real football. Everything wipes clean when the season rolls over.",
    "You will see it in a few places. Your Dashboard lists who is banned and for how long, next to the injury report. Suspended players carry a small red card next to their name on the Roster, on the pitch view and on their profile, and they get left out of your XI automatically until it is served, the same way injuries already work.",
    "Referees also got stricter, because once bans existed I actually measured the booking rate and it was about a third of a real league's. Yellows are up from roughly 1.4 a game to 2.3, and red cards come with them, from about one every ten games to one every five, which is a normal rate. That is still short of a real referee, and the reason is fouls rather than cards: the engine whistles fewer fouls than a real match does, so it already books a higher share of the ones it gives. Scoring barely moved, about a hundredth of a goal a game.",
    "Yellows and reds are also counted properly now. They show up per season on a player's profile, and there are yellow card and red card boards on Stat Leaders if you want to know who your worst offender is. Seasons you played before this went in will read zero, because nothing was keeping a running total at the time and I would rather show you a blank than a number I had to guess at.",
  ],
};

export default entry;
