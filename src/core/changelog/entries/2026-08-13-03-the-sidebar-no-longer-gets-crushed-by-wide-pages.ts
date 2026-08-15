import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-13",
  title: "The sidebar no longer gets crushed by wide pages on desktop",
  items: [
    "On desktop, a page wider than the window squeezed the navigation sidebar down to make room instead of scrolling. The Roster page was the usual trigger: once a season is underway its squad table carries a full set of stat columns, and on a typical window that was enough to shrink the sidebar to a sliver. The sidebar now keeps its width everywhere, and a page that genuinely needs more room than the window has scrolls sideways within the content area, the same way wide tables already behave on phones.",
  ],
};

export default entry;
