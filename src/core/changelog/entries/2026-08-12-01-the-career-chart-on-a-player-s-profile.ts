import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-12",
  title: "The career chart on a player's profile now tracks his transfer value",
  items: [
    "The chart on a player's profile plotted his OVR against the seasons he'd played. It now plots his transfer value, so the shape of a career reads the way it does on a real transfer-value chart: what the market thought he was worth, rising through his twenties and falling away after. The line is still colored by whichever club he was at, with club crests marking his transfers, and the axis starts at zero so a steady career isn't dressed up as a dramatic one. Above the chart sits his value today and, if it isn't now, the season he peaked and what he was worth then.",
    "The OVR chart hasn't gone anywhere. A Value/OVR switch in the corner of the panel flips between the two, because they answer different questions and come apart in a way that's worth seeing: an aging player's rating can hold flat for years while his value drops away underneath it, since the market is paying for the seasons he has left as much as for how good he is right now.",
    "Hovering a season used to show the club and the OVR. It now opens a card with his value that season, his age, his OVR and POT, his goals and assists, his appearances, his average match rating, and the club, with a season he spent in a youth academy marked as such. A season he was in the squad for but never played reads as a dash rather than as zero goals. Age sits next to the season because it drives most of the curve's shape.",
    "Ratings only change in the offseason, so a player's value genuinely moves once a year and there is one real reading per season. The curve drawn between two seasons is a smooth join, not a set of extra measurements, and hovering always snaps to a season and reports that season's real numbers.",
    "The value is worked out with the same formula the transfer market uses, which prices in potential as well as current ability. That means it goes through scouting the same way every other potential figure does: while your scouts only have a range on a player's POT, the chart is priced off the middle of that range rather than the hidden number, and it sharpens as their estimate does. Contract length is the one input held flat across the whole career, because old contract terms aren't recorded in a save — so the shape of the line reads on ability, age and potential, while the final point still matches what he'd cost today.",
    "Because everything is worked back out of ratings already stored in the save, an existing league gets its full career charts immediately. Retired players' profiles keep the OVR chart on its own, since a market value would mean nothing for someone who has stopped playing.",
    "Hovering a club crest on either chart used to describe a loan, a loan return and a genuine free transfer all as \"free\", which made a loan spell look like a player who kept leaving for nothing. Each now reads as what it was, with the loan fee where there is one.",
  ],
};

export default entry;
