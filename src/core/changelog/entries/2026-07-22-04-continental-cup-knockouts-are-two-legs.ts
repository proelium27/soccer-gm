import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-07-22",
  title: "Continental Cup knockouts are two legs now",
  items: [
    "Somebody said the cup felt way too random compared to how teams do in the league, and they were right. I dug into it and the cause wasn't the ratings or the cross-league stuff like I first guessed, it was just the format: single-match knockouts are basically a coin flip between two good teams, and then extra time and penalties on top of that. Winning three of those in a row barely has anything to do with being the best side, so a team could steamroll its league and still go out of the cup in the first round for no real reason.",
    "So I made the quarter-finals and semi-finals two-legged, home and away, decided on aggregate (both teams' goals across the two games added up). Each side hosts once, on separate matchdays like the real thing: the first legs go on one matchday and the second legs a couple later. If it's still level after both legs it goes to extra time and then penalties, same as before. The final stays a single game at a neutral venue, and the league-phase playoff stays one game too. Playing two matches instead of one lets the better team's quality actually show, and the home-and-away swap cancels out home advantage, so cup results track how strong you really are a lot more now. The cup page shows both leg scores under each tie so you can see how it played out.",
    "While I was in there I also made your Continental Cup games show up on your Schedule page, mixed in with your league fixtures, so you can see your whole season in one place instead of bouncing over to the cup bracket.",
    "Heads up: any cup already in progress in your save finishes under the old single-game rules, and the next one you play will be two-legged.",
  ],
};

export default entry;
