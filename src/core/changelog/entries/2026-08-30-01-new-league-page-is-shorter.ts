import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-30",
  title: "The New League page got a lot shorter",
  items: [
    "It had turned into a long scroll, and two things you pick once for the whole save, difficulty and the start year, were sitting below the club list. They're near the top now, where you'd expect them.",
    "**World setup** starts closed. It's a dozen countries with a row each, and most saves take the world as it ships, so you don't scroll past all of it every time any more. It tells you what you'd get without opening it: 12 countries, 36 divisions, 626 clubs. Hit **Customize** on it when you do want to change something. If you loaded a roster file it opens by itself, since adding or renaming a league in there is usually what makes your file apply.",
    "The club list shows one division at a time. England was forty clubs in a row, which buried everything underneath it. There are tabs for the two divisions now, named after the divisions themselves. Switching between them doesn't lose the club you already picked, it just tells you which one it's in.",
    "There's a **League name** box. Leave it alone and your save is named after your club, the way it always was. Fill it in and that's what shows on the Leagues screen instead, which helps once you've got three saves in the same country.",
    "Between the two, the page is about a third shorter than it was before you scroll anywhere.",
  ],
};

export default entry;
