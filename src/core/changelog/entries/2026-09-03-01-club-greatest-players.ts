import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-09-03",
  title: "Every club has a greatest-players board now",
  items: [
    "Club History has a **Greatest Players** board. Top ten, ranked the way the GOAT board on Frivolities ranks the world: peak rating, the years he held it, awards, trophies. Nothing new is stored for it, so it works on every save you already have and covers seasons you played long before today.",
    "It scores his time **at your club**, not his career, and that's where nearly all the work went. The easy version is to take the world ranking and filter it down to men who played for you, and it falls apart the first time you look at it: a winger who gave you one season and then spent a decade winning everything abroad would sit above the man who played 400 games for you. So every number in a row is a number he earned here. The years he was at the club, the games he played for it, the rating he peaked at while he was yours.",
    "Awards would otherwise follow him everywhere, so they're scoped the same way. A Player of the Season he won in your shirt counts. One he won after he left goes on that club's board instead. League titles count if he was on your books that season, whether or not he got on the pitch for it, because winning it from the bench is still winning it. His World Cup isn't on there at all, that one belongs to his country.",
    "Goals and assists are missing from the score, and that's a real limitation rather than a decision I'm happy with. Once a player retires the game keeps his career totals but not his totals club by club, so I could either work out his goals-for-you from his goals-for-everyone and be wrong, or leave them out. Leaving them out at least means the board means the same thing for the players who are gone as for the ones still playing, and they're who a club's all-time list is mostly about. Storing enough to fix it costs real space in every save, so I want to weigh that up on its own.",
    "Click any row for the full arithmetic, same as on the GOAT board.",
    "The game keeps a permanent record of the most notable careers only, so the further back your save runs the thinner the old names get. Once your club has more than twenty seasons behind it the board says so, rather than quietly looking like you had nobody worth remembering before the current squad.",
  ],
};

export default entry;
