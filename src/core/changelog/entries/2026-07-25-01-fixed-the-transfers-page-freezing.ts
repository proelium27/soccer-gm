import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-07-25",
  title: "Fixed the transfers page freezing",
  items: [
    "There was an issue with the speed of the transfers page along with the entire game in general. Someone sent me their save and I could finally sit down and watch it happen, and on the transfers page the culprit was the \"Completed This Window\" list at the bottom. It was drawing every single transfer in the window, and in a world of 240 clubs that's thousands. On that save it was trying to draw 2,056 rows, each with a little national flag next to it, which came to over 10,000 things on screen and about a megabyte of flag artwork. Some of those flags are enormously detailed files being shrunk down to 13 pixels tall, so your browser was doing a colossal amount of work to draw something you can barely see. That's what locked the whole page up, and it's why it was only ever the transfers page.",
    "Now it shows all of your own club's business, plus the 50 biggest deals elsewhere, and tells you how many others went through with a link to the News Feed for the full list. On that same save it went from 10,684 things on screen down to 603.",
    "Worth saying plainly: the transfers page part of this had nothing to do with how long you'd been playing, so if that page was unusable for you it should just work now. The game-wide slowness is the entry below this one.",
  ],
};

export default entry;
