import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-31",
  title: "Renaming a league no longer breaks your roster file",
  items: [
    "Roster files find the league they fill by name, so renaming England's top division to the Premier League in World setup used to mean every file written for \"English Division 1\" skipped it. You could have real names for your leagues or real players in them, not both.",
    "Now a name that matches nothing gets read as the country and division it describes, and the game looks there instead. Rename all 24 divisions if you like and **Download Real Rosters** still fills every one of them.",
    "It works because a country's name isn't yours to change on a shipped league, only its divisions' names are. So \"English Division 1\" is still a reliable way of saying \"England, top flight\" after the label has gone.",
    "A file can also say so outright, with a `country` and `tier` on each competition. The prompt behind **Copy AI prompt** asks for them now, and anything you export carries them.",
    "The name still matters the other way round. A file written for a league this world hasn't got, the Eredivisie if you've switched the Netherlands off, fills nothing until you add that league or rename one to it. That part hasn't changed.",
  ],
};

export default entry;
