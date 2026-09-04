import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-09-04",
  title: "Club History opens on your own club",
  items: [
    "Going to **Club History** from the sidebar used to drop you on whichever club happens to be first in the world. It opens on yours now, which is what it was always supposed to do and what the manual has been claiming it did. If you've been picking yourself out of the dropdown every time you go there, you can stop.",
    "The page reads which club to show out of the address bar, so that a link to one particular club works and the back button walks you back through the ones you looked at. With nothing in the address bar it read that as a zero, and zero is a real club rather than a blank, so off you went to the first English side. Links to a specific club were never affected.",
  ],
};

export default entry;
