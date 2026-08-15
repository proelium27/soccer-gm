import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-12",
  title: "Starting a league can no longer create several copies of it",
  items: [
    "Starting a new league could leave three or four identical saves in the list, all for the same club. Building a world means filling 240 clubs with players, which takes a few seconds and freezes the page while it runs. The Start League button stayed enabled and gave no sign anything was happening, so a second or third click was the natural response, and the browser held those clicks and delivered them once the page came back. Each one started another league.",
    "The button now switches to \"Building your world...\" and disables itself the moment it's pressed, with a line underneath explaining that the page will sit still for a few seconds. Any extra clicks that arrive during the wait are discarded rather than queued, so one press is one league no matter how many times it's pressed. Importing a save file goes through the same guard.",
    "The leagues list now shows the season each save has reached and the time it was started, not just the date. Saves are named after the club, so duplicates of the same club looked identical; the season is what identifies the one that's actually been played. Any duplicates already sitting in the list can be removed with Delete.",
  ],
};

export default entry;
