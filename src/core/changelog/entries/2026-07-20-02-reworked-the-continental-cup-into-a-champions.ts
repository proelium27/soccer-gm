import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-07-20",
  title: "Reworked the Continental Cup into a Champions-League-style league phase",
  items: [
    "Before the cup was a straight sixteen team knockout, but France and Portugal only got 1 team each and they had to play in a play-in game. This kinda sucked so I rebuilt the whole thing. It is now modeled like the modern Champions League with the league format.",
    "It's now 20 clubs. The big four still send their top four, but France and Portugal each send their top two now instead of just the champion. Everyone starts in one big league phase and plays six games, and the draw is balanced with pots so nobody randomly gets six giants or six easy games (and you never draw a club from your own league). After six rounds the table splits: top four go straight to the quarter-finals, 5th through 12th play a one-off playoff for the last four spots, and 13th through 20th are out. Then it's quarter-finals, semis and final like before.",
  ],
};

export default entry;
