import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-22",
  title: "Retired players stop turning into \"Player #4821\"",
  items: [
    "When a player retires I delete him, and I keep a permanent career record only for the ones worth putting on the all-time lists: 2,000 of them, ranked by how good the career was. Everyone else's name went in the bin along with him, while the transfer he was part of and the goal he scored on the news feed stayed in your save pointing at nobody. On a 100-season save that's 78% of every historical reference, because the bar for those 2,000 slots keeps climbing as the years pile up. By season 100 you have to have peaked at 79 to hold one, so a club legend who topped out at 76 got dropped.",
    "The mistake was using one record for two jobs. A career record is big, about 2,200 bytes, because it carries career totals and a best season in every stat, and capping it makes sense: an all-time list only ever wants the top of it. Printing somebody's name needs five fields and 82 bytes. So names have their own record now, with no cap at all, kept for every retiree your save still mentions anywhere. It runs about 20 KB a season, roughly a twentieth of what the history referencing it costs, so there was never anything worth saving by throwing the names away.",
    "I simmed a dynasty to check it holds: references pointing at nobody, counted season by season, zero every time. The career records and the all-time lists are unchanged, and so is everything about how the game plays.",
    "This covers players who retire from here on. Anyone your save had already deleted is still gone, and the other change I've shipped today is the only thing that gets any of those back.",
  ],
};

export default entry;
