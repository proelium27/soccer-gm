import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-22",
  title: "More of those missing names are back, including on old saves",
  items: [
    "Keeping award winners' names last update only helped seasons played from then on. On a save already deep into a dynasty it did nothing. Loading the 100-season save I test against named 30.2% of its award places before and 30.2% after: every winner it could still identify was already showing. That change stops the losses from here, it doesn't undo the ones already taken.",
    "Every offseason the Season Preview writes down the biggest retirements of the year with each player's country and position, and I'd never read that list back. It has been sitting in your save the whole time doing nothing but filling one page. The game reads it now, everywhere a player ID gets turned into a name. On the same save it puts names on 1,056 more award places, 9,323 more transfer rows, 11,343 more news items and 2,268 more cup stat lines. Those lists are already in your file, so an old league picks this up the moment you load it.",
    "A player recovered this way is a name and nothing else, so like an award winner he isn't a link to a career page. The list also records him as he was in his final season, which for an award he won twelve years earlier is the wrong rating, so those chips show no rating rather than a confident wrong one.",
    "About two thirds of the player references in a century-long save point at men nothing ever wrote down. Those I can't fix, and there's nowhere left to look them up.",
  ],
};

export default entry;
