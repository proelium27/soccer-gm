import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-09-01",
  title: "The Dashboard now shows you the rest of the world",
  items: [
    "There are three new panels along the bottom of the Dashboard. **Power rankings** puts the ten best clubs in the world side by side, which is the one place you can see all 24 divisions measured against each other, and your own club is picked out if you're in there. Beside it are the **Continental Cup** and **Continental Shield**, showing the league phase table while they're in that stage and then the bracket once the knockout starts, round by round as it's played.",
    "In the offseason, whenever there's a tournament on, it gets a panel of its own: the **World Cup** bracket every fourth year, and the **confederation cups** two years later, all of them at once, so you can watch the Euros, the Copa and the Africa Cup of Nations settle in the same glance. In the two quiet years there's no panel, because there's nothing but qualifying to show.",
    "Everything about your own club stays exactly where it was. The new panels are added underneath rather than worked into the middle, so nothing you're used to reaching for has moved. They're summaries with a link through to the full page, too, so there's nothing here you couldn't already get to.",
    "Spectator saves get all of it as well, which is really what prompted this. Watching a world without a club of your own is a lot better when you can see who's rising and how the cups are going without leaving the page. They also get the **matchday itself** next to the table, every game in the league you've picked with the score once it's been played, so simming a round actually shows you something.",
    "The strip that scrolls past while you're simming counts each round for you as it goes, games played and goals scored. It's built out of your own club's results normally, and with no club it had nothing to put there.",
  ],
};

export default entry;
