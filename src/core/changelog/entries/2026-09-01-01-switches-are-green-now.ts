import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-09-01",
  title: "The tickboxes and switches finally match the rest of the game",
  items: [
    "Every checkbox and toggle in the game was drawing itself in the default blue that Bootstrap ships with, which is not a colour that appears anywhere else in here. They're the pitch green now, like everything else you can click.",
    "The switches that were already dotted around, **Never sack me** on the Manager page, the depth chart toggles, **Every chance** in the live match viewer, had the same problem in the other direction: switched off, the little knob was drawn for a white page, so on this one it was almost invisible and an off switch looked like an empty slot. It's a proper light knob now.",
    "While I was in there, the settings that were still tickboxes became switches: the New League screen's options, the **Only show players I can actually bid on** filter on Transfers, and a league's money link in World setup. The ones that stayed tickboxes are the ones that aren't really settings, like choosing which countries go in your world, or the God Mode boxes that only do anything when you hit Save.",
  ],
};

export default entry;
