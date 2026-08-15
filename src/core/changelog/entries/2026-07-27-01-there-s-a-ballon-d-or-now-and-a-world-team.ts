import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-07-27",
  title: "There's a Ballon d'Or now, and a World Team of the Year",
  items: [
    "Up to now every award in the game was decided inside one league. You could win Player of the Season in England and never find out whether the guy tearing it up in Spain was better than you. So the Awards page has a World tab now, with a Ballon d'Or for the best player alive that season, a top-10 shortlist behind him, and a World Team of the Year best XI picked from anywhere on the planet. Your league's own Player of the Season, Golden Boot and Team of the Season are all still there, just under the By league tab.",
    "Comparing players across leagues is the whole problem, and it's worth knowing how it's handled. Match ratings are scored against the standard of the league you play in, so a 7.5 average in Portugal and a 7.5 in England look identical on paper even though one was earned against much easier opponents. The world award corrects for how strong each league actually is. It's a correction and not a punishment: a genuinely better player in France or Portugal still beats a merely good one in England.",
    "Four things decide it. Your domestic season, scored the way Player of the Season is. The Continental Cup, where your goals, assists and rating all count. The summer's international football, worth double in a World Cup year. And trophies, which count for a lot: winning your league is worth roughly ten league goals to a striker, the Continental Cup a bit more, the World Cup more again, and they stack. On top of all that it leans fairly heavily on how good the player actually is, more than your own league's Player of the Season does, because a rating is the one number that means the same thing in every league. The winner's card shows you the full split, so you can always see exactly what he won it on.",
    "What that means in practice: the winner is usually one of the handful of genuinely best players alive rather than whoever racked up the most goals, and he's usually won something. Strikers take it about 45% of the time, attacking midfielders and wingers win a fair share, and I've seen a fullback win one. Nobody is guaranteed it. The leading scorer won't always win, a treble winner won't always win, and the best player in the world won't always win. Whoever the season made the strongest case for does.",
    "Two smaller things came with it. Ballon d'Or wins and World Team of the Year places now show up in a player's honours on his profile, next to his league awards. And I found a bug while I was in there: the Cup tab on a player's profile was only counting the quarter-finals onward, silently dropping all six of his league-phase games. That's fixed, so cup stat lines are fuller now than they were, on old saves too.",
  ],
};

export default entry;
