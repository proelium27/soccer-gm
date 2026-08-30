import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-29",
  title: "The last promotion place is now a playoff",
  items: [
    "Finishing third in England's second division no longer gets you promoted. The last promotion place is played for now, and each country uses the system it actually uses in real life. You can change any of them in World setup when you start a save, shipped countries included.",
    "**The English system**, which most countries here run, keeps the top clubs going up automatically and hands the last place to the four that finished below them: two-legged semi-finals, then a one-off final at a neutral ground the way England's is at Wembley. So England, Spain, Italy, France and Turkey promote 1st and 2nd on the table and have 3rd through 6th play it out. Finishing higher only gets you the tie against the lowest-placed club, because over two legs you each host once and nobody is at home for the final. Across 44 finals I ran, the four clubs won 23%, 21%, 25% and 32% of them, which is to say it's near enough a lottery. Real playoffs are too, and that's the appeal: sixth place has something to chase in March.",
    "**The German system**, which Germany runs, points the place at both divisions at once. One fewer club goes up automatically and one fewer goes down, then the club that just missed out below plays the lowest club that just survived above, home and away, for the remaining top-flight place. Win it from below and you swap places with them. Win it from above and nobody moves at all, so that season Germany promotes and relegates one club fewer than usual. It's a much harder way up, because you're playing a Bundesliga side rather than your own division's stragglers, and in my testing the top-flight club usually holds on.",
    "Scotland promotes a single club and so has no playoff by default. An English bracket needs an automatic place to sit below it, and the only bracket available at one place would be the top four, which means taking promotion off the champion. You can still give Scotland the German system if you want one there.",
    "It's played the instant the season ends, before anyone retires or changes club, so a veteran on his way out gets one last match. Injuries keep you out of it. Suspensions don't, because there are no matchdays left to serve a ban against.",
    "There's a **Promotion Playoffs** page in the sidebar with the bracket or the tie, both legs, the aggregate and the shootout where it went that far. It has a dropdown for each country and each season you've played, so you can go back and look at the one that cost you. Your own country's result also shows up in the News Feed and on the Dashboard.",
    "Nothing changes retroactively if you're mid-save. Every promotion already in your history was decided on the table and stays that way, and your first playoff is at the end of the season you're in.",
  ],
};

export default entry;
