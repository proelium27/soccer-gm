import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-22",
  title: "Your best players earn the stats now",
  items: [
    "When something happened in a match, the game picked which player got credited for it. Position mattered a lot in that pick, but the player's actual ability barely did: at the same position, an 80-rated player was only about 1.8 times as likely to be the one credited as a 40-rated one. Good enough to sort a striker from a centre-back, nowhere near good enough to sort a good centre-back from a poor one.",
    "That's why a defender's stat line never told you much. Tackles and interceptions were spread around the back four almost evenly, so the tackles board was closer to a list of who plays a lot than a list of who defends well.",
    "Ability counts for much more in that pick now. The same pair is about 3.2 times apart. Measured over a full simmed league season, how well a defender's tackling predicts his tackles and interceptions went up by about half, and the top of the board is now genuinely made up of better defenders.",
    "It applies to the things players **earn**: shots, goals, assists, tackles, interceptions, and getting on the end of corners. It deliberately doesn't apply to fouls, which are picked with the same kind of draw. Steepening that one would have made your best defender your most-booked player, which is backwards.",
    "**Creation gained the most.** Assists were already moved onto passing earlier today, and with this on top, how well a midfielder's passing predicts his assists is now roughly half again as strong, while its link to his general rating actually got weaker. That's the point: the assists column should tell you who creates, not just who's good.",
    "Scoring is basically untouched. The number of tackles, shots and assists handed out in a match hasn't changed at all, only who gets them, so goals per game moved by about a quarter of a percent and the golden boot by a couple of goals. Results will differ slightly from what the same save would have produced before, because who gets credited feeds match ratings and match ratings feed substitutions.",
  ],
};

export default entry;
