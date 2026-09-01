import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-09-01",
  title: "The tickboxes and switches finally match the rest of the game",
  items: [
    "Every checkbox and toggle in the game was drawing itself in the default blue that Bootstrap ships with, which is not a colour that appears anywhere else in here. They're the pitch green now, like everything else you can click.",
    "The switches that were already dotted around, **Never sack me** on the Manager page, the depth chart toggles, **Every chance** in the live match viewer, had the same problem in the other direction: switched off, the little knob was drawn for a white page, so on this one it was almost invisible and an off switch looked like an empty slot. It's a proper light knob now.",
    "While I was in there, the New League screen's options became switches too, so that whole page is one kind of control instead of two.",
  ],
};

export default entry;
