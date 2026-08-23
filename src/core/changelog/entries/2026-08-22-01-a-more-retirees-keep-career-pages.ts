import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-22",
  title: "Ten times as many retirees keep a career page",
  items: [
    "The permanent career record held 2,000 players, ranked by how good the career was, and on a long save that bar gets brutal: by season 100 you had to have peaked at 79 to hold a slot. It now holds 20,000. Measured on a simmed world, about 270 retirees a season qualify once careers have had time to lengthen, so that's roughly 75 seasons of everyone who qualifies keeping a full page, against about 7 before.",
    "The old limit wasn't about disk space, which is why it could go up so far. Every time you changed a lineup or signed anyone, the game rewrote that entire list along with the rest of the save. At 2,000 players that was 11 milliseconds of every single action, and it would have been 91 at 20,000, on top of everything else. The list has its own storage now and only newly retired players get written, so the size of it costs nothing while you play.",
    "One consequence worth flagging: your saves are now on a newer database format. If I ever have to roll the site back to an older version, that version won't be able to open them until I roll forward again. Nothing is lost when that happens, but if you want a copy you control, Export Save on the Leagues page writes one out.",
    "Also fixed: God Mode no longer creates players called \"New Player\". The name box starts empty and Create stays disabled until you type something, because whatever it was created with sticks to him forever, including on the all-time boards.",
  ],
};

export default entry;
