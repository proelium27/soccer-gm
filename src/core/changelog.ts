/**
 * Player-facing changelog: a hand-maintained, reverse-chronological record of
 * every player-visible change, shown on the /changelog page (sidebar, under
 * Help, next to the Manual).
 *
 * Keeping it in sync (same bar as the Manual — see CLAUDE.md):
 * - When a player-visible feature ships, changes, or is removed, PREPEND an
 *   entry here in the same PR. Newest entry goes first (top of the array).
 * - Write in plain, player-facing language (second person, like the Manual) —
 *   this is what players read, not a commit log. Don't quote hidden values.
 * - Group a batch of related changes shipped together under one dated entry.
 *
 * `date` is an ISO date string (YYYY-MM-DD); the page formats it for display.
 */
export interface ChangelogEntry {
  date: string;
  title: string;
  /** One bullet per change, in plain player-facing language. */
  items: string[];
}

/** Newest first. Prepend new entries at the top. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-07-20",
    title: "No more free-agent flipping, and a thinner free-agent pool",
    items: [
      "Closed a loophole: you could sign a free agent for nothing and immediately sell him for a fee. Now a free agent you sign onto your senior roster can't be sold until the following season. No AI club will bid on him in the meantime, and the Roster page shows \"Can't sell yet (just signed)\" until the hold clears. You can still release him for free whenever you like.",
      "The free-agent pool is weaker now. Each offseason the AI clubs work it before you do, and they'll grab any genuinely useful free agent to upgrade a spot, not just to fill a hole. By the time you reach the Free Agents page, most of the good ones are already gone. Bargains still turn up, but they're the exception, not the rule.",
    ],
  },
  {
    date: "2026-07-20",
    title: "You can't just buy your way to the top anymore",
    items: [
      "A common bit of feedback: winning the league gets too easy once you have money to spend. So building a champion is now genuinely harder.",
      "The very best players can't be bought. The league's genuine elite are now priced so high that no club can afford them, yours included. You can still buy a solid, competitive squad, but the difference-makers who actually win titles aren't for sale at any price. To get one, you have to develop him yourself or bring him through your academy.",
      "The upshot: money buys you a good team, not a great one. Winning the top flight now takes patience and a bit of luck in who you develop, not just a fat transfer budget.",
    ],
  },
  {
    date: "2026-07-20",
    title: "\"Copy AI Prompt to Customize\" moved to the top bar",
    items: [
      "The button that copies an AI prompt for importing real teams (now labeled \"Copy AI Prompt to Customize\") lives in the top bar while you're in a save, instead of on each save's row on the Leagues screen. Export Teams and Import Teams stay on the Leagues screen.",
    ],
  },
  {
    date: "2026-07-20",
    title: "Finishing skill now decides who scores",
    items: [
      "A shot going in used to depend only on how good your team was overall, not on who was taking it, so a brilliant finisher stuck on a weak side didn't score any more than his teammates would have.",
      "Now the individual finisher matters. Whether a shot goes in leans on the specific player taking it, measured against his own teammates, so a clear standout will bury chances the rest of the side would waste and pile up goals even on a struggling team. Corners work the same way off a player's heading.",
      "It's a redistribution, not a goal fountain: your best finishers score more than their share, weaker ones score less, and the league's overall scoring is unchanged. One knock-on effect is that a season's top scorer can now push into the mid-30s, like real-world Golden Boot winners.",
      "Expected goals (xG) is unchanged and still team-blind, which means beating your xG is now exactly what a great finisher looks like.",
    ],
  },
  {
    date: "2026-07-20",
    title: "Import real teams and players from a file",
    items: [
      "A lot of you asked to bring real teams into the game. You can now do it: the Leagues screen has \"Export Teams\" and \"Import Teams\" on every save.",
      "Export Teams downloads a plain text (JSON) file listing every club in your world, grouped by league. Edit it however you like, or hand it to an AI and ask it to fill in a real league, then load it back with Import Teams. It matches clubs to your leagues by slot, so it's the easiest way to turn the fictional default world into real ones.",
      "Rename in bulk: change a club's name, abbreviation, and colors from the file instead of one at a time (same as Customize Teams). Include only the leagues you care about and leave the rest alone.",
      "Bring in real squads: a club can also carry a list of players. Give each one a name, position, and age, plus either an overall (the game builds ratings to match) or exact ratings for full control. List as many or as few as you want, whatever you leave short is topped up with reserves so the team is always playable. Importing a squad replaces that club's players, so it's best done on a fresh save.",
      "Don't want to write JSON by hand? Hit \"Copy AI Prompt to Customize\" and it copies a ready-made prompt, already filled in with your world's league names and sizes, that teaches ChatGPT or Claude exactly how to build the file. Paste it, ask for the leagues you want, and save the reply.",
    ],
  },
  {
    date: "2026-07-20",
    title: "God Mode: a sandbox for building your dream league",
    items: [
      "A lot of you asked for a Basketball GM-style \"God Mode,\" a sandbox where you can override the game instead of just playing it straight. It's here, and it's completely optional.",
      "Turn it on (or off) any time from the \"God Mode\" button in the top bar. It's per save, and there's no penalty. Flip it on to tinker, flip it off to go back to a normal career. When it's on, a \"God Mode\" section shows up in the sidebar and edit controls light up around the game.",
      "Edit any player. Open any player's profile (yours or a rival's) and hit Edit. You can change every one of his 14 ratings (his overall updates live as you go), plus his potential, name, nationality, age, position, height, and his contract wage and length. You can also clear an injury outright.",
      "Move players wherever you want. From a player's profile, send him to any club instantly, with no transfer fee, no budget check, and no roster limit, or release him to free agency in one click.",
      "Create players from scratch. The God Mode page has a Create Player tool where you build a brand-new player (every rating, position, age, potential and contract) and drop him straight onto any club or leave him a free agent.",
      "Rebuild any club's roster. Pick any club on the God Mode page and add, move, or release its players directly, so you can put together the exact squads you want across the whole world.",
      "Set club finances and identity. Give any club whatever budget and hype you want, and rename or recolor any club.",
      "See true potential. While God Mode is on, the scouting fog lifts, so every player's exact potential shows everywhere instead of an estimated range.",
      "A few things it won't do on purpose: it can't add or delete whole clubs, erase a player from history (releasing him is how you get rid of him), or force a match result or change the standings. Everything else keeps simulating normally around your edits.",
    ],
  },
  {
    date: "2026-07-20",
    title: "Two new leagues: France and Portugal",
    items: [
      "A lot of you have been asking for more leagues, so France and Portugal are in the game now, each with their own two-division setup. That brings the world up to six countries and 240 clubs.",
      "They're both meant to be weaker than the four leagues you already know, and Portugal is the weakest of the bunch. Their clubs have smaller budgets, so they tend to sell their best players off to the richer leagues instead of buying.",
      "They play in the Continental Cup too, but only each country's champion gets in, and even then it has to win a play-in round first just to reach the main 16-team bracket.",
    ],
  },
  {
    date: "2026-07-20",
    title: "See your Starting XI's stats at a glance",
    items: [
      "A few of you pointed out that you could see season stats for your bench players but not for anyone in your Starting XI. Thanks for flagging it!",
      "The Roster page now shows a stats table for your Starting XI, right below the pitch, with the same columns as the bench table (appearances, minutes, goals, assists, tackles, rating and more), so you can read every starter's season without moving him off the pitch.",
    ],
  },
  {
    date: "2026-07-20",
    title: "Easier lineup swaps on mobile",
    items: [
      "We saw a lot of players struggling to move players in and out of the Starting XI on mobile, since drag-and-drop doesn't work well on phones.",
      "Now you can just tap the four dots on the left side of a player, then tap a spot in the Starting XI (or another player) to swap them in. Drag-and-drop still works too if you're on a computer.",
    ],
  },
];
