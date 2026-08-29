import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-29",
  title: "Retune the countries the game ships, not just the ones you add",
  items: [
    "World setup let you build a league from scratch and then wouldn't let you touch the eight countries already in it. You could rename their divisions and that was the lot. Hit **Customize** next to any of them now and you get the whole panel: strength, money, one division or two, how many clubs are in each, how many go up and down, Continental Cup and Shield places, who the league produces, and a roster import of its own.",
    "So you can make Portugal a big-four league, cut Belgium down to twelve clubs, seal off Germany's second division so nobody goes up or down, or hand Turkey thirty-six clubs of your own out of a roster file. Getting any of that used to mean switching the country off and rebuilding it from scratch.",
    "Every control opens on what that country actually is, not on a blank. France starts at strength 15 and money 0.70 because that's France, and England's Continental Cup box reads 4 because that's what a big-four league sends. Anything you don't move stays exactly as it always was, so a world you don't touch generates the same game it always did.",
    "Money is still tied to strength by default, and the panel still warns you when your settings would float a weak league above a strong one over a long save. Continental places follow strength too, so dragging a big-four league down starts it sending two clubs to the Cup instead of four, which changes the size of the field.",
    "The one thing you can't change on a shipped country is its name. Its clubs, its flag and its player nationalities all hang off it. Want a country the game hasn't got? Switch one off and add your own, which is what adding was always for.",
    "Fixed on the way past: loading a roster file that declared its own nationality mix into an added league kept the mix and quietly dropped the clubs.",
  ],
};

export default entry;
