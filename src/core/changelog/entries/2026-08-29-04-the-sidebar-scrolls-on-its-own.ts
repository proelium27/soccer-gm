import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-29",
  title: "The sidebar scrolls on its own",
  items: [
    "The menu down the left used to scroll away with the page, so getting from halfway down a long page to National Teams or the Manual meant scrolling back to the top first. It stays where it is now, sitting under the top bar, and if there are more links than fit on your screen it scrolls its own list. Scrolling the page doesn't move the menu, and scrolling the menu doesn't move the page.",
    "Phones are unchanged. The menu there is already a drawer with its own scroll, so it never had this problem.",
  ],
};

export default entry;
