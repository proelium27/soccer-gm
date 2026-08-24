import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-24",
  title: "Long saves crash less, especially on phones",
  items: [
    "Someone told me their save was crashing at season 56 on mobile. They were right.",
    "Every time you sim, the game hands your whole save to a background worker so the page doesn't freeze, and the worker hands the whole thing back when it's done. Two full copies on every advance. I simmed a world out to season 56 to see what that costs, and the save had grown to **165 MB**, which means one sim is shifting something like half a gigabyte around at once. A phone kills the tab rather than allow that.",
    "So I stopped sending the parts the simulation never looks at. The retiree archive and the power rankings history are both write-only as far as the sim goes: it adds to them and never reads them back, so they can stay where they are while the worker works. That's **31 MB less** in each direction, and the copy itself is about a third faster.",
    "I also cut how often power rankings get snapshotted, from eight times a season to four. Each snapshot is a row for every club in the world and they're kept forever, which is a lot of save for a page you look at now and then. You'll see it on the Power Rankings page: the dropdown of past points in a season is shorter, about one per quarter of the season instead of one every five matchdays. Snapshots you already have are left alone.",
    "This helps but it doesn't finish the job. It takes roughly a quarter off the heaviest thing your save does, which should buy real headroom on a phone, but a save deep into a dynasty is still big. The largest piece left is the cup histories, and those are harder to move, because the game reads them when it tidies up after players it has deleted. I'll get to it.",
    "Nothing about how your league plays has changed. The results are identical.",
  ],
};

export default entry;
