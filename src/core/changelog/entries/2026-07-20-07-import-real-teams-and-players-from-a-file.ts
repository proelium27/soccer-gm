import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-07-20",
  title: "Import real teams and players from a file",
  list: true,
  items: [
    "A lot of you asked to bring real teams into the game, so now you can. Every save on the Leagues screen has \"Export Teams\" and \"Import Teams\".",
    "Export Teams downloads a plain text (JSON) file listing every club in your world, grouped by league. Edit it however you like, or hand it to an AI and ask it to fill in a real league, then load it back with Import Teams. It matches clubs to your leagues by slot, so it's the easiest way to turn the fictional default world into real ones.",
    "Rename in bulk: change a club's name, abbreviation, and colors from the file instead of one at a time (same as Customize Teams). Include only the leagues you care about and leave the rest alone.",
    "Bring in real squads: a club can also carry a list of players. Give each one a name, position, and age, plus either an overall (the game builds ratings to match) or exact ratings for full control. List as many or as few as you want, whatever you leave short is topped up with reserves so the team is always playable. Importing a squad replaces that club's players, so it's best done on a fresh save.",
    "Don't want to write JSON by hand? Hit \"Copy AI Prompt to Customize\" and it copies a ready-made prompt, already filled in with your world's league names and sizes, that teaches ChatGPT or Claude exactly how to build the file. Paste it, ask for the leagues you want, and save the reply.",
  ],
};

export default entry;
