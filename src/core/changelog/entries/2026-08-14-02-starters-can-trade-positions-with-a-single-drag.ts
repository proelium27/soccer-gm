import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-14",
  title: "Starters can trade positions with a single drag",
  items: [
    "Two players already in the Starting XI can now be dragged onto each other to trade positions, leaving the rest of the eleven untouched. Previously a drag only registered when it moved a player between the bench and the pitch, so switching two starters took a three-step detour: drop a spare bench player into the first man's slot to push him out, drag him onto the second man's slot, then bring the displaced second man back on in place of the spare. Tapping one player's handle and then another works the same way on touch devices. The one pairing still refused is a keeper and an outfielder, since nobody but a keeper can go in goal.",
    "The restriction made sense until the previous update. While team strength was rolled up from what kind of player each man was, reordering two starters changed nothing at all, so there was nothing to allow. Team strength is now built slot by slot, so moving a midfielder up into an attacking slot, or dropping a winger back into a full-back slot, is a real tactical decision, and it should not require routing a player through the bench to make it. A player moved this way is judged on the slot he ends up in, and pays the usual out-of-position cost when it is not his own position.",
  ],
};

export default entry;
