import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-08",
  title: "Belgium and Turkey join the world",
  items: [
    "New saves now span eight countries instead of six. Belgium and Turkey each arrive with a full two-division pyramid, 20 clubs per division, bringing the world to 16 leagues and 320 clubs. Both are pickable at the start like any other country. Existing saves keep the country set they were created with; there is no mid-save world expansion.",
    "The two sit at the bottom of the strength ladder, below Portugal, with Turkey weakest of the eight. That ordering follows the real UEFA five-year country coefficient, though the in-game gaps between the four weaker leagues are deliberately tighter than the real ones, because mapping the real gaps literally generates squads too weak to be playable.",
    "Money follows the same order: France can bank the most of the four, then Portugal, Belgium and Turkey. Both new leagues are selling leagues, and Turkey is the poorest as well as the weakest. The real Belgian Pro League actually has a smaller combined squad value than the Super Lig despite ranking above it in Europe, and an earlier version of this update modelled that inversion. It was dropped after testing: a richer league steadily climbs over a long save, so a weaker-but-richer Turkey overtook Belgium outright within twenty seasons and the intended ordering stopped meaning anything. Keeping the money in the same order as the strength keeps each league where it is supposed to sit for the life of a save.",
    "Squad nationalities are drawn from each league's real breakdown. Belgian squads are roughly 38% Belgian with a large French contingent and unusually strong Japanese and West African pipelines; Turkish squads are close to half domestic, with the rest led by Brazil, Francophone West Africa and a distinctive Balkan group.",
    "The Continental Cup grows from 20 clubs to 24 to fit them in. The big four still send their top four each, and all four weaker leagues now send their top two, for 4x4 + 4x2 = 24. The format is otherwise unchanged: one league phase of six games, top four straight to the quarter-finals, 5th through 12th into the playoff round. Because the field is larger while the knockout stage is not, 13th through 24th now go out at the league phase instead of 13th through 20th.",
  ],
};

export default entry;
