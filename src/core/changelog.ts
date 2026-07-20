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
