import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-19",
  title: "I redrew both cup brackets",
  items: [
    "I wasn't happy with how either cup page drew its knockout rounds, so I redid both. The Continental Cup is a real bracket: the quarter-final winners feed known semi-final slots, so a tie now sits between the two ties that feed it, with lines joining them up. The domestic cup isn't a bracket at all. Its survivors go back in the hat every round and nothing feeds anything, so it gets dense columns of results instead. Drawing them the same way made one of them look like something it isn't.",
    "Who went through is obvious now. The club that won a tie is tinted and bold, the one that went out is greyed back, and the final gets gold. Each round header also shows how many ties are in it, so you can see how much of the cup is left.",
    "On a phone the bracket moves one round per swipe. The columns were narrow enough that the screen always came to rest halfway between two rounds, and since the score sits on the right hand edge of a tie, it was the score you couldn't see. A round is a screenful now, with a sliver of the next one showing so you can tell there's more.",
  ],
};

export default entry;
