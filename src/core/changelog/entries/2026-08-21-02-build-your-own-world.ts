import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-21",
  title: "Build your own world",
  items: [
    "**New League** has a **World setup** panel now. You choose which of the eight countries are in your save, and you can add leagues of your own on top of them. None of it can be changed later, so it's worth a minute before you start.",
    "A league you add gets its own settings: how strong its squads are, how much money its clubs have, and how many places it sends to the Continental Cup and the Continental Shield. Its clubs get generated names and colours, same as the rest of the game's fictional clubs.",
    "**Strength and academies are two separate sliders**, and that's the one I'd play with first. Strength is how good the league is on day one. Academies is what its clubs keep turning out year after year. Set academies stronger than strength and the league climbs; set them weaker and it slowly fades. Testing it, a league that generated almost 2 points below its neighbour finished a point and a half above it after three seasons, on academies alone.",
    "Money follows strength unless you tell it not to. You can unlink them, but a weak league with big money creeps up the pecking order over a long save until it sits above leagues it has no business beating, so you get a warning when you set one up that way.",
    "Each league you add has its own **Import roster** button, so you can bring real clubs and squads into it. It takes the same roster files as the full import, but it only touches that one league, and it doesn't care what the file calls its competitions: the first one in the file fills the top division and the second fills the one below. So a file written for somebody else's world drops straight into a league you just invented. Any club slot the file doesn't cover keeps the invented club it came with.",
    "Whatever numbers you pick, the **Shield starts exactly where the Cup stops** in each league. Send 1 to the Cup and 3 to the Shield and you get your champion in the Cup and 2nd through 4th in the Shield. No club ever ends up in both, and no place goes unused.",
    "Saves you're already playing are untouched, since this only shapes a world at the moment you create it.",
  ],
};

export default entry;
