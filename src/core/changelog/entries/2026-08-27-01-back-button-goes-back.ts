import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-27",
  title: "The back button goes back",
  items: [
    "Back on a player's page didn't go back. I'd wired it to a fixed destination, Stat Leaders for anyone who wasn't yours and your Roster for anyone who was, so opening a player from the news feed, the transfer market, an all-time list or a box score and then hitting Back dropped you somewhere you'd never asked for.",
    "It walks your history now. Wherever you clicked the player from is where Back returns you to, and the same goes for a retired player's page.",
    "A club's season page has a Back link now, and so does a box score. The box score had one already, but it always went to the Schedule even when you'd arrived from somewhere else.",
    "If you open a page cold, from a bookmark or a reload or a link someone sent you, there's no history to walk back through, so Back takes you to a sensible fixed page the way it used to.",
  ],
};

export default entry;
