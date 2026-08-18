import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-17",
  title: "Weak clubs were producing unusable youth",
  items: [
    "A club's academy generates its youth around a fixed strength anchor, and I then subtract a flat amount from it, because a 16-year-old should be well short of the first team. The problem is that the anchor spans a huge range across the world, from the German top flight down to the Turkish second division, and the amount I subtract is the same everywhere. At the bottom it subtracted past zero.",
    "When that happens every rating is generated below the minimum and pinned to it, so you don't get a weak player, you get a broken one. A striker would come out with 1 pace, 1 passing, 1 dribbling and 1 positioning. **73 of the 320 clubs** were doing this, and in a single offseason **472 of 1,268 new prospects arrived at 15 OVR or worse**. Someone sent me a save with a 16-year-old striker at **9 OVR**, which is how I found it.",
    "The subtraction now eases onto a floor instead of running off the end. The weakest club in the world went from an intake averaging **4 OVR** to one averaging **13.5**, and from a best prospect of 9 to one of 25.",
    "The thing I had to be careful about is that this only touches the clubs that were actually broken. My first attempt used a wider curve, and it lifted 295 of the 320 clubs, which quietly made the whole world better and pushed the poorer leagues into debt over a long save. The version that shipped leaves every healthy club generating exactly what it generated before, down to the last rating point.",
    "These are still bad players, to be clear. A Turkish second-division academy should produce bad players. They're just recognisably footballers now, and they differ from each other, which the old ones didn't.",
  ],
};

export default entry;
