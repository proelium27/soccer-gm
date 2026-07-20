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
  {
    date: "2026-07-19",
    title: "Generational talents & historic seasons",
    items: [
      "Every so often a truly special young player now comes through — a once-in-a-generation talent who can climb far higher than a normal prospect. Their arrival is announced in the News Feed.",
      "Any club can now have a magical or a disastrous season out of nowhere — a hidden season-long form swing that lifts (or sinks) a whole squad's results. Your club is eligible for both.",
    ],
  },
  {
    date: "2026-07-19",
    title: "Renamed to World Soccer Simulator",
    items: [
      "The game is now called World Soccer Simulator.",
      "The interface is now fully responsive, so it works properly on phones and tablets.",
    ],
  },
  {
    date: "2026-07-19",
    title: "The Continental Cup",
    items: [
      "A new 16-team knockout tournament runs alongside the league season, contested by the top four clubs of each of the four top-flight leagues.",
      "Qualification is purely by league position, ties are single-leg (extra time then penalties if level), and there's prize money at every round. See the new Continental Cup page.",
    ],
  },
  {
    date: "2026-07-19",
    title: "Power Rankings history & help hints",
    items: [
      "You can now browse past power rankings from several points during each season, not just the current standing.",
      "Contextual \"?\" hints now sit next to section titles and tricky columns — hover or focus one for a one-line explanation.",
    ],
  },
  {
    date: "2026-07-18",
    title: "Scouting affects what you can see",
    items: [
      "A player's potential is now shown as a range (a low–high estimate) rather than an exact number, until you've scouted him.",
      "Spending more on scouting narrows that range and reveals it faster; owning a player for a few seasons also clears the fog. Your scouting budget is now locked in for the season once it starts.",
    ],
  },
  {
    date: "2026-07-18",
    title: "Loans",
    items: [
      "You can now loan a player out to another club for one to three seasons instead of selling him — good for a young player stuck behind a better one who needs real minutes.",
      "List a player on the new Loans page and review interested clubs' offers.",
    ],
  },
  {
    date: "2026-07-17",
    title: "A whole world of leagues",
    items: [
      "New saves now span four countries — England, Spain, Italy and Germany — each with its own two-division pyramid, all sharing one global transfer market.",
      "Pick your country and club when you start a new save.",
    ],
  },
  {
    date: "2026-07-15",
    title: "Promotion, relegation & club history",
    items: [
      "There's now a second division below the top flight, with real 3-up / 3-down promotion and relegation every season — your club included.",
      "A new Club History page shows any club's trophy case, honours, records and season-by-season results.",
    ],
  },
  {
    date: "2026-07-14",
    title: "Awards, career charts & the visual pitch",
    items: [
      "End-of-season awards — Player of the Season, Golden Boot and a Team of the Season — are shown automatically once you finish simming a season.",
      "The Roster page now shows your Starting XI on an interactive pitch, with selectable formations and drag-and-drop between the XI and bench.",
      "Each player's profile now includes an OVR-over-time chart tracing his whole career, with club crests marking his transfers.",
    ],
  },
];
