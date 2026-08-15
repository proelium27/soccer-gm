import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-07-25",
  title: "A crash no longer wipes out the whole game",
  items: [
    "Someone told me the transfers tab keeps crashing on them, and when I went looking I realised I had no way at all to find out why. Any error anywhere in the game took down the entire screen and left you staring at a blank white page, with the actual reason buried in the browser console where nobody's going to look for it. On top of that, I'd never switched on crash reporting, so not a single one of these had ever been recorded. I was completely blind to it.",
    "So: if a page breaks now, you get an actual error message on that page instead of a white screen. The menu keeps working so you can click away to somewhere else, there's a Try again button, and the details are there to copy into a bug report. Your save is never touched when this happens, which is worth saying because a blank screen makes it look like everything's gone. Crashes now also get reported to me automatically with the technical details attached, so I can actually chase them down.",
    "I want to be straight with you: this doesn't fix the transfers crash itself. I hunted for it pretty hard, threw about 1,250 different combinations of filters and league states at that page, and couldn't get it to break once, so I don't yet know what's triggering it. What I've done is make sure that the next time it happens to anyone, I'll get the error instead of a shrug. If it hits you, please send me what the error box says.",
  ],
};

export default entry;
