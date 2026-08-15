import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-07-21",
  title: "Free agents aren't a wall of the same position anymore",
  items: [
    "Someone pointed out the free agent list was always too good and always the same position, usually a pile of defensive and attacking mids. The problem was position supply. New youth prospects were getting a totally random position, but clubs only carry two DMs and two AMs versus four center backs or fullbacks, so those positions kept overproducing and the surplus leaked into free agency (while center back and fullback quietly ran short over long careers). I now hand out youth positions weighted by how many of each a squad actually needs, which keeps the pipeline matched to demand.",
    "That helps the overall pool, but DM and AM still only get two spots per club, so a genuinely good third one always ends up cut loose no matter what. So on top of that I fixed what you see: the Free Agents page now caps how many of any one position show up in the default list, so it can't be a wall of eight defensive mids anymore. There's a position dropdown if you want to see the full depth at one spot.",
  ],
};

export default entry;
