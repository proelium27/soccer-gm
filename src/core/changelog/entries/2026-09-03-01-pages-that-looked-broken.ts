import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-09-03",
  title: "The pages that looked broken weren't, but they looked it",
  items: [
    "I went through every screen in the game one at a time, at desktop size and on a phone, and graded them. Most came out fine. Nine came out badly, and all nine were broken the same way: a heading, one grey sentence, and then a screen of nothing. Continental Shield, Domestic Cup, Champions Cups, Promotion Playoffs, Academy, Watchlist, and half the National Teams section.",
    "None of them were bugs. They were all correctly empty, because those competitions genuinely haven't started yet. But a sentence floating on a black page looks exactly like a page that failed to load, and four of them sit next to each other in the sidebar, so clicking down that list felt like walking through an unfinished game.",
    "They're in a proper panel now, and they say more than \"nothing here yet\". Each one tells you **when it fills up** and what it'll hold. The Domestic Cup one points out that it's an open draw across every division, which is where the upsets come from. Promotion Playoffs walks through the two shapes and which countries use which. The Academy page changed most: it now tells you prospects draw a flat stipend and don't count against your 30-man roster, which has been true all along but was only ever written in a tooltip nobody hovers, and it links you to Incoming Talent so you can sign one today instead of waiting for the offseason.",
    "The Standings page was calling the **wrong club champion**. From the first matchday of the season, whoever was top of the table had a trophy and the word \"Champion\" against their name. One game in. The code even had a comment saying a champion only means something once the season's actually been decided, and then checked whether *any* game had been played instead of whether the season was over. It waits for the season to finish now.",
    "Your News Feed will be shorter on a long save, and that's me heading off a freeze. The feed keeps everything forever, so it only grows, and on a three-season save it was already drawing 956 rows and about 1,900 flag images into one page. That's more than the transfers page was rendering back when it used to lock the whole site up. Each season now shows its 150 biggest stories and tells you how many it held back. **Everything involving your club is always shown**, however far down the season it happened.",
    "A few colours were wrong and I'd stopped seeing them. Three toggles (Value/OVR and League/Cup on a player's profile, Players/Clubs on Frivolities) were rendering in stock Bootstrap blue, inches away from green buttons doing the same job. The Schedule's marker for the last matchday you played was Bootstrap cyan, and it was drawing a box around the whole row instead of a bar down the left of it. The trophy beside a champion was an emoji, which is the one thing the rest of this game's icons deliberately aren't.",
    "The National Teams pages had their headings upside down. All eleven put **National Teams** in big text with the actual page name smaller underneath, so the loudest thing on every one of those screens was the word that doesn't change between them. They're the other way round now.",
  ],
};

export default entry;
