import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-11",
  title: "Import takes several roster files at once",
  items: [
    "A roster file covering a dozen leagues with full squads is not something an AI will write in one answer, so people were building their world a league at a time and ending up with a folder of files: england 1.json, england 2.json, france 1.json, and so on. Import only read one of them, and picking a second started a separate league rather than adding to the first, which left no way to assemble a whole world out of the files it was practical to generate.",
    "Import now accepts as many roster files as you select, and combines them into one league. The club picker lists everything that loaded and has an \"Add another file\" button, so you can also go back for the next league later instead of selecting all of them up front. If a file fails to load, the message names the file that failed rather than just refusing the batch.",
    "Files stack in the order they load, and a competition covered by two of them is taken from the later file, with a note saying which one was used. Anything no file covers keeps its original clubs and squads, exactly as before. The AI prompt in the top bar now also tells the assistant to hand back the leagues it can fit properly and say which are left, instead of thinning out every squad to cram a whole world into one reply.",
  ],
};

export default entry;
