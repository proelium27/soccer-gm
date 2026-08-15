import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-09",
  title: "Importing a save reports what went wrong, and can no longer overwrite another league",
  list: true,
  items: [
    "Importing a saved game did nothing visible when the file wasn't one. The import checked the file and raised a clear complaint, but nothing displayed it: the error went only to the browser's developer console, the screen never changed, and the button read as broken. Both import buttons, \"Import League\" on the New League screen and \"Import\" in the top bar, now show what was wrong with the file and leave the rest of the game alone.",
    "The most common cause was handing \"Import League\" a teams file rather than a saved game. The two take different files: \"Import League\" wants a whole save downloaded with Export, while a teams file made by \"Export Teams\" or the AI prompt is applied with \"Import Teams\" on the Leagues screen. That case is now recognized by name and says which button to use instead.",
    "A separate fault in the same import destroyed saves. A save file carries the internal slot it occupied in the browser that exported it, and the import wrote it back to that same slot, replacing whatever league already sat there without warning. Importing a file from another browser, another computer, or someone else could therefore erase a league in progress. Imports now always arrive as a new save and never write over an existing one.",
    "The manual now covers exporting and importing saves, which it previously left undocumented.",
  ],
};

export default entry;
