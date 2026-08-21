import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-21",
  title: "Award winners keep their names",
  items: [
    "An old honours board could tell you an award happened but not who won it. I was only storing the winner's player ID, and when a player retires I delete him from the save. Only the careers worth remembering get a permanent record, and a second division's Player of the Season usually isn't one of them, so the winner turned into \"Player #4821\" or the card claimed nobody had qualified for an award that had very much been handed out. I checked four real saves. At 11 seasons that's 8 of 176 league Players of the Season. At 32 seasons, 152 of 512. At 100 seasons, 1,177 of 1,600, which is 74%, plus 30 of the 100 Ballon d'Ors.",
    "Every award now stores the winner's name, country, position, and the club and rating he had that season, written down the moment he wins it. The Awards page names him, the awards record book in Frivolities ranks him, and his award counts toward his club's and his country's totals, which it didn't before: a winner nobody could identify was crediting nobody. There's no career page behind him, so his name isn't a link.",
    "On a save already in progress I can only keep what's still there. Loading it writes down every winner the save can still name, which stops the losses from here on. Anyone already deleted is gone for good and his slot stays blank.",
  ],
};

export default entry;
