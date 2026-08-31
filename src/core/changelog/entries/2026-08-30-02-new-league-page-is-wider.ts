import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-30",
  title: "The New League page uses the width of your screen",
  items: [
    "It was pinned to a narrow column down the middle with a lot of nothing either side of it, which is right on a phone and a waste of a monitor. It's wider on a desktop now, so the country tabs wrap a lot less.",
    "The club list is two columns when the window has room for them. A twenty club top flight is ten rows instead of twenty, and a row isn't mostly empty space any more. On a narrow window it's still one club per line.",
    "So is the country list you pick a national team from, which was a narrow strip down the left with the rest of the page empty next to it. There are over a hundred countries in there, so seeing twice as many at once is worth a lot.",
    "The difficulty, country and division tabs pick out the one you're on in green now, like everything else in the game does. They were grey, which was left over from before the game had a look of its own, and it meant the page answered \"which one is selected\" two different ways depending on where you looked.",
    "The screen where you name the clubs yourself got the same treatment, so the name box is wide enough for a long one.",
  ],
};

export default entry;
