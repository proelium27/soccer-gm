import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-21",
  title: "The player profile shows every stat the game records",
  items: [
    "The season table on a player's profile was showing about half of what the sim tracks. Passes, pass completion, crosses and fouls were being recorded every match and then never displayed anywhere on his page. They're in the table now, along with goals+assists, shot accuracy and conversion rate.",
    "A **Career** row sits under the seasons and adds up everything above it. It's worked out from the underlying totals rather than by averaging the rows, so a 38-game season counts for more than a six-game one in his career pass completion or match rating.",
    "The column I'd look at first is **goals over xG**. Every shot gets an xG value that doesn't care who's taking it, so the gap between a player's goals and his xG is a clean read on finishing: 20 goals from 13.5 xG means he's burying chances an average forward would miss. It runs both ways. Across a season the league as a whole finishes almost exactly on its xG, so a player sitting below the line really is wasting what he gets.",
    "Keepers get the same idea in reverse, **goals prevented**: xG against minus what he actually let in, so positive means he's saving shots that normally go in. Save percentage is there too. The shooting columns now disappear for keepers rather than sitting there reading zero, and if one of them has actually scored he keeps them.",
    "The Totals / Per 90 switch covers all of it. Percentages and match ratings stay as they are when you flip it, since they're already rates and dividing them by matches played would mean nothing.",
    "The **Cup** tab got the average match rating column it should have had all along. That table stays thinner than the league one, with no xG, passing or cards, because cup matches are stored as a summary rather than a full stat line and I can't fill in seasons you've already played.",
  ],
};

export default entry;
