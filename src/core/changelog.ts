/**
 * Player-facing changelog: a hand-maintained, reverse-chronological record of
 * every player-visible change, shown on the /changelog page (sidebar, under
 * Help, next to the Manual).
 *
 * Keeping it in sync (same bar as the Manual — see CLAUDE.md):
 * - When a player-visible feature ships, changes, or is removed, PREPEND an
 *   entry here in the same PR. Newest entry goes first (top of the array).
 * - Write in the dev's own FIRST-PERSON voice: casual, personal, and honest,
 *   like you're talking straight to players ("Me and a few people noticed X,
 *   so I did Y"). It's fine to share the reasoning behind a change and to be
 *   specific about how it works (even quoting a number) if that helps players
 *   understand it — this is what players read, not a commit log. Match the
 *   tone of the existing entries.
 * - Group a batch of related changes shipped together under one dated entry.
 * - Formatting: entries render as prose paragraphs (one per `items` string) by
 *   default — most entries should read as a short first-person note, NOT a
 *   bulleted list. Only set `list: true` when the post genuinely enumerates a
 *   bunch of distinct features (e.g. God Mode, Import Teams); then `items`
 *   render as bullets.
 *
 * `date` is an ISO date string (YYYY-MM-DD); the page formats it for display.
 */
export interface ChangelogEntry {
  date: string;
  title: string;
  /** Each string is one paragraph (default) or one bullet (when `list` is true). */
  items: string[];
  /** Render `items` as a bulleted list instead of prose paragraphs — only for feature enumerations. */
  list?: boolean;
}

/** Newest first. Prepend new entries at the top. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-07-28",
    title: "Retirement now depends on whether anyone actually wanted you",
    items: [
      "Retirement was embarrassingly simple before this and I don't think many people noticed, which is sort of the problem. It was pure age. Nobody could retire before 33, and after that everyone rolled the same dice. A 33-year-old who was the best player in your league and a 33-year-old who couldn't get off the bench had exactly the same chance of packing it in. How good you were never entered into it at all.",
      "Now two things decide it. Age still does most of the work, but whether a club actually had you on their books last season scales it. Hold down a squad place and your odds drop by about 40%, which is enough that a player good enough to keep playing can still be going at 39 or 40 instead of almost certainly being gone by 38. It's not a free pass and there's no age where a great veteran is safe, he just lasts as long as he's worth a place, which is how it should have worked all along.",
      "The other end of it is that players nobody signs now drift out of the game, at any age. Before, someone who never got picked up just sat in the free agent pool from 16 until he turned 33, because that was the first age retirement could touch him. So the pool filled up with people who were never going to play again and never went anywhere. Now, going a full season with no club starts the clock whether you're 19 or 35. There's a grace period so this can't blindside you: a contract simply running out doesn't count against a player, so everyone gets one full free agency to find a club first.",
      "One deliberate exception, because the first version of this was too brutal. Genuine prospects don't wash out. If a young player's ceiling is still high he'll wait around for his shot however long it takes, so the promising kids on your Incoming Talent page aren't on a timer. It's the journeymen who clear out. What you'll notice is that the free agent list is a bit thinner and a bit older than it used to be, and someone you passed on twice might not be there a third time.",
      "The Manual has said for a while that \"declining veterans and marginal players go first\" and that a still-elite 34-year-old will often play on. That was wishful thinking on my part, it was never true, and it is now.",
    ],
  },
  {
    date: "2026-07-27",
    title: "There's a Ballon d'Or now, and a World Team of the Year",
    items: [
      "Up to now every award in the game was decided inside one league. You could win Player of the Season in England and never find out whether the guy tearing it up in Spain was better than you. So the Awards page has a World tab now, with a Ballon d'Or for the best player alive that season, a top-10 shortlist behind him, and a World Team of the Year best XI picked from anywhere on the planet. Your league's own Player of the Season, Golden Boot and Team of the Season are all still there, just under the By league tab.",
      "Comparing players across leagues is the whole problem, and it's worth knowing how it's handled. Match ratings are scored against the standard of the league you play in, so a 7.5 average in Portugal and a 7.5 in England look identical on paper even though one was earned against much easier opponents. The world award corrects for how strong each league actually is. It's a correction and not a punishment: a genuinely better player in France or Portugal still beats a merely good one in England.",
      "Four things decide it. Your domestic season, scored the way Player of the Season is. The Continental Cup, where your goals, assists and rating all count. The summer's international football, worth double in a World Cup year. And trophies, which count for a lot: winning your league is worth roughly ten league goals to a striker, the Continental Cup a bit more, the World Cup more again, and they stack. On top of all that it leans fairly heavily on how good the player actually is, more than your own league's Player of the Season does, because a rating is the one number that means the same thing in every league. The winner's card shows you the full split, so you can always see exactly what he won it on.",
      "What that means in practice: the winner is usually one of the handful of genuinely best players alive rather than whoever racked up the most goals, and he's usually won something. Strikers take it about 45% of the time, attacking midfielders and wingers win a fair share, and I've seen a fullback win one. Nobody is guaranteed it. The leading scorer won't always win, a treble winner won't always win, and the best player in the world won't always win. Whoever the season made the strongest case for does.",
      "Two smaller things came with it. Ballon d'Or wins and World Team of the Year places now show up in a player's honours on his profile, next to his league awards. And I found a bug while I was in there: the Cup tab on a player's profile was only counting the quarter-finals onward, silently dropping all six of his league-phase games. That's fixed, so cup stat lines are fuller now than they were, on old saves too.",
    ],
  },
  {
    date: "2026-07-27",
    title: "All-time single-season leaderboards let a player show up twice",
    items: [
      "Small fix on Stat Leaders. If you set the season dropdown to All Seasons and then picked Single Season, it was only ever showing each player's own best year, one row per player. So if the same striker had the two best scoring seasons in your league's history, you'd only ever see one of them, and the actual second-best season in the record book was hidden behind him.",
      "Now every season a player recorded is its own row, so those two years sit next to each other at the top where they belong, and the board reads like a proper all-time list. There's a Season column so you can tell which year each line is. Career totals are unchanged, one row per player as before.",
    ],
  },
  {
    date: "2026-07-25",
    title: "Fixed the transfers page freezing",
    items: [
      "There was an issue with the speed of the transfers page along with the entire game in general. Someone sent me their save and I could finally sit down and watch it happen, and on the transfers page the culprit was the \"Completed This Window\" list at the bottom. It was drawing every single transfer in the window, and in a world of 240 clubs that's thousands. On that save it was trying to draw 2,056 rows, each with a little national flag next to it, which came to over 10,000 things on screen and about a megabyte of flag artwork. Some of those flags are enormously detailed files being shrunk down to 13 pixels tall, so your browser was doing a colossal amount of work to draw something you can barely see. That's what locked the whole page up, and it's why it was only ever the transfers page.",
      "Now it shows all of your own club's business, plus the 50 biggest deals elsewhere, and tells you how many others went through with a link to the News Feed for the full list. On that same save it went from 10,684 things on screen down to 603.",
      "Worth saying plainly: the transfers page part of this had nothing to do with how long you'd been playing, so if that page was unusable for you it should just work now. The game-wide slowness is the entry below this one.",
    ],
  },
  {
    date: "2026-07-25",
    title: "Long saves are a lot faster, and a lot smaller",
    items: [
      "Separately from the transfers freeze above, saves were getting enormous, and the game rewrites the entire save every single time anything happens in it. By season 14 that file was 88 MB and writing it took seconds, which made everything feel sluggish the longer you played.",
      "Two things were bloating it. First, every Continental Cup league-phase match was keeping a full per-player stat sheet forever, even though literally nothing in the game ever displayed them. That was 17% of your save doing absolutely nothing. Those are gone and you won't notice a single difference, all the scorelines and tables and knockout stats are still there.",
      "Second, and this is the real one: free agents never went away. Ever. Every washed-out academy kid who nobody signed just sat in your save forever, and by season 14 there were 9,245 of them against only 5,996 players actually on teams. 96% of them had never even reached 55 overall. So now, once a free agent is 24 or older, has never been any good, and isn't projected to become good, he's permanently deleted. Anyone under 24 is safe, anyone with real potential is safe, and any former star who's declined is safe, so your incoming talent list and the useful end of free agency are untouched.",
      "Result: that 88 MB save drops to 49 MB, and the slowest thing the game does got about 11 times faster. The pool now settles at a stable size instead of climbing forever, so it shouldn't creep back.",
      "Two honest warnings. This permanently deletes those players from your existing save the first time you load it, and I can't undo that, so if you had a sentimental attachment to a 44-overall 31-year-old free agent, I'm sorry. And while I was in here I found a genuinely nasty old bug: because of how new players got their ID numbers, a newly generated player could occasionally inherit a deleted player's entire transfer history. That's fixed properly now.",
      "Last thing, and this one's a genuine bug fix I stumbled into. Cup stats on player profiles were badly wrong, and had been forever. The Continental Cup has three stages (the league phase, the playoff, then the knockouts) and the code that built a player's Cup tab was only ever looking at the knockout ties. So if your club played all six league-phase games and went out in the playoff, every single one of your players showed zero cup appearances. Even if you made the quarter-finals, your six group games didn't count. In one season I checked, players had played 1,857 cup games between them and the profiles were showing 199 of them.",
      "That's fixed: cup stats now count every stage. Your players' cup appearances and goals will jump, in some cases a lot, and that's them finally being counted properly rather than anything being inflated. Old seasons are corrected too, because I fold the numbers up before throwing the detailed match data away (which is also how the cup history got about eight times smaller).",
    ],
  },
  {
    date: "2026-07-25",
    title: "A crash no longer wipes out the whole game",
    items: [
      "Someone told me the transfers tab keeps crashing on them, and when I went looking I realised I had no way at all to find out why. Any error anywhere in the game took down the entire screen and left you staring at a blank white page, with the actual reason buried in the browser console where nobody's going to look for it. On top of that, I'd never switched on crash reporting, so not a single one of these had ever been recorded. I was completely blind to it.",
      "So: if a page breaks now, you get an actual error message on that page instead of a white screen. The menu keeps working so you can click away to somewhere else, there's a Try again button, and the details are there to copy into a bug report. Your save is never touched when this happens, which is worth saying because a blank screen makes it look like everything's gone. Crashes now also get reported to me automatically with the technical details attached, so I can actually chase them down.",
      "I want to be straight with you: this doesn't fix the transfers crash itself. I hunted for it pretty hard, threw about 1,250 different combinations of filters and league states at that page, and couldn't get it to break once, so I don't yet know what's triggering it. What I've done is make sure that the next time it happens to anyone, I'll get the error instead of a shrug. If it hits you, please send me what the error box says.",
    ],
  },
  {
    date: "2026-07-25",
    title: "Your players go to the World Cup now",
    items: [
      "I added international football. Your players represent their countries in the summer, on a four-year cycle: there's a World Cup every fourth season, and the three offseasons before it each play a round of qualifying (a proper long home-and-away campaign, not a one-off). The 16 who make it play the World Cup itself: four groups of four, then quarter-finals, semis and a final. It all happens between seasons, so it doesn't touch your league at all, and there's a whole National Teams section in the sidebar where you can follow it.",
      "Nobody manages a national team, not even you. Each country just picks its best available squad, so the whole thing is really about developing players good enough to get called up and then watching how they do. Every nation with enough players in the world enters qualifying, and confederations that actually have strong teams get more places, so the field ends up looking like it should.",
      "One thing I like: squads are picked from the shape your players are in at the end of the club season, injuries and all. So if your star pulls up injured in May, he genuinely misses the tournament. It also plays out before anyone retires now, so a veteran in his last season gets one final shot at it. Caps, goals, tournaments and titles all build up on each player's profile over his career. For now the only way any of it touches your club is injuries: if a player gets hurt at the World Cup or in qualifying, part of it heals over the summer, but a serious injury carries into the new season and he misses the opening weeks (a minor knock clears up before kickoff). His value and development still aren't affected by international stuff, and I left tournament tiredness out for now.",
      "You play the tournament yourself instead of it all resolving in one silent step. When you hit the offseason in an international summer, the Dashboard gives you buttons: play qualifying in a qualifying year, or play the group stage, then the quarter-finals, then the semis, then the final in a World Cup year, one at a time so you can actually watch it happen. There's a 'sim through the World Cup' button if you'd rather skip ahead, and you can't advance to the next season until it's done.",
      "There's a proper National Teams section in the sidebar now, not just one page. It's got the current World Cup and Qualifying (and you can flip back to past years), a Rosters tab with every nation's squad for whatever campaign is being played, a Schedule of fixtures (it opens on the qualifying round being played right now, because a full campaign is about 280 games and drawing all of them at once made the page crawl), Power Rankings of every nation with how they've moved, Stat Leaders for both the best nations and the best players (filter it to one country to see who your guys are up against), and a History tab with past winners and each nation's record. Old tournaments keep their results and tables so you can look back on them, I just don't hang onto every single box score forever or the save would balloon.",
      "The Rosters tab is the one I keep clicking on myself. Pick a nation and you get its whole squad, best nations first, with the eleven it would actually field highlighted, everyone's club, and their caps and international goals. It's a quick way to see how many of your own players made it and who they're competing with for a shirt. And on a player's profile there's now a National Team tab next to League and Cup, breaking his international record down campaign by campaign instead of just showing the career totals. That one only fills in going forward, since I never stored the per-campaign detail before.",
    ],
  },
  {
    date: "2026-07-23",
    title: "One-click Best XI on the Roster page",
    items: [
      "Setting up your lineup meant picking a formation from the dropdown and then dragging players around, which is fine if you enjoy that but a bit of a chore if you just want to field your best team and get on with it. So there's now a Best XI button right next to the formation dropdown on the Roster page. Click it and the game picks whichever of the nine shapes lets you field your strongest eleven, then fills the lineup for you, exactly the way the AI sets up its own clubs. You can still tweak the formation or drag people around afterward if you want to override it.",
    ],
  },
  {
    date: "2026-07-22",
    title: "Free signings finally show up in a player's history",
    items: [
      "A few of you flagged a nasty one: sign a guy off the free agents or incoming talent page and he'd play for you fine (wages, appearances, all of it), but his profile would insist he was still at some club he'd left seasons ago, and he seemed to get bounced around between clubs for no reason. Turns out free-agent moves were never getting recorded anywhere, so the profile rebuilt each player's club-by-season history purely from paid transfers and just guessed wrong whenever a free move happened. About 1 in 5 players league-wide was showing the wrong current club because of it.",
      "Now every free signing gets logged like a real move (fee of zero, from \"Free agent\"), so his transfer history, his OVR chart's club colors, and the News Feed all line up with where he actually is. That includes signing a prospect straight into your academy, which was the version of this most of you were running into. Old saves can't be back-filled, so a player's history before this update may still be a little off, but everything from here on is correct.",
      "I left the routine AI free-agent shuffling out of the News Feed and the completed-transfers lists on purpose, it's over a thousand signings a season and would bury everything else. Your own free signings still show up there.",
      "While I was in there: the Roster page now flags anyone in the final year of his deal with a \"Final year\" badge and a banner, since nobody re-signs your players for you and it was too easy to let someone walk for free without noticing. The Academy page got the same warning, because academy stipends expire on exactly the same schedule and losing a prospect you'd developed for three seasons that way is worse.",
    ],
  },
  {
    date: "2026-07-22",
    title: "You can finally see who's injured",
    items: [
      "Injuries have always been in the game, but they haven't been displayed in the UI. Now injured players show a little red cross next to their name; if you hover over it, you can see what the injury is and how long until they're expected back. Injuries are also now displayed in your dashboard.",
    ],
  },
  {
    date: "2026-07-22",
    title: "Subs",
    items: [
      "The in-match coach used to just sub off the most tired players but now the coach also decides who to sub off based on OVR and match performance.",
      "On the roster page, you can also now direct the in-match coach to give a bench player more minutes than he would regularly. This feature is for players who have a very high potential because more playing time=more progression.",
    ],
  },
  {
    date: "2026-07-22",
    title: "Continental Cup knockouts are two legs now",
    items: [
      "Somebody said the cup felt way too random compared to how teams do in the league, and they were right. I dug into it and the cause wasn't the ratings or the cross-league stuff like I first guessed, it was just the format: single-match knockouts are basically a coin flip between two good teams, and then extra time and penalties on top of that. Winning three of those in a row barely has anything to do with being the best side, so a team could steamroll its league and still go out of the cup in the first round for no real reason.",
      "So I made the quarter-finals and semi-finals two-legged, home and away, decided on aggregate (both teams' goals across the two games added up). Each side hosts once, on separate matchdays like the real thing: the first legs go on one matchday and the second legs a couple later. If it's still level after both legs it goes to extra time and then penalties, same as before. The final stays a single game at a neutral venue, and the league-phase playoff stays one game too. Playing two matches instead of one lets the better team's quality actually show, and the home-and-away swap cancels out home advantage, so cup results track how strong you really are a lot more now. The cup page shows both leg scores under each tie so you can see how it played out.",
      "While I was in there I also made your Continental Cup games show up on your Schedule page, mixed in with your league fixtures, so you can see your whole season in one place instead of bouncing over to the cup bracket.",
      "Heads up: any cup already in progress in your save finishes under the old single-game rules, and the next one you play will be two-legged.",
    ],
  },
  {
    date: "2026-07-22",
    title: "There's a Discord now",
    items: [
      "I set up a Discord server for the game and dropped a link to it in the sidebar, down in the Help section under the Manual and Changelog. Come hang out, report bugs, tell me what's broken or what you'd want next. It opens in a new tab so it won't blow away your save.",
    ],
  },
  {
    date: "2026-07-21",
    title: "Free agents aren't a wall of the same position anymore",
    items: [
      "Someone pointed out the free agent list was always too good and always the same position, usually a pile of defensive and attacking mids. The problem was position supply. New youth prospects were getting a totally random position, but clubs only carry two DMs and two AMs versus four center backs or fullbacks, so those positions kept overproducing and the surplus leaked into free agency (while center back and fullback quietly ran short over long careers). I now hand out youth positions weighted by how many of each a squad actually needs, which keeps the pipeline matched to demand.",
      "That helps the overall pool, but DM and AM still only get two spots per club, so a genuinely good third one always ends up cut loose no matter what. So on top of that I fixed what you see: the Free Agents page now caps how many of any one position show up in the default list, so it can't be a wall of eight defensive mids anymore. There's a position dropdown if you want to see the full depth at one spot.",
    ],
  },
  {
    date: "2026-07-21",
    title: "Click a column header to sort it",
    items: [
      "A bunch of the tables around the game were stuck in one fixed order, which was annoying when you wanted to, say, find the youngest free agent or the club with the biggest wage bill. Now you can click a column header to sort by it, and click again to flip the direction (there's a little arrow showing which way it's going). I wired it up on the tables where it actually helps: the Transfers search, Free Agents, Incoming Talent, Incoming Offers, the Academy, the Loans pages, the league-wide finances table, the Standings (sort by GD, OVR, whatever you like, and the position number stays honest), and the God Mode roster editor. The Roster and Stat Leaders pages already had their own thing going, so I left those alone.",
    ],
  },
  {
    date: "2026-07-21",
    title: "Search for any player in the world",
    items: [
      "The recommended transfers list only ever showed you a handful of players near your own team's level, and a bunch of you wanted to just go find a specific guy and make a bid. So I added a \"Search all players\" panel right under the recommendations on the Transfers page. Type a name, or set filters like position, min overall, min potential, max age, or max value, and it'll pull up matching players from every club in the world (not just your league) and let you put in an offer right there.",
    ],
  },
  {
    date: "2026-07-21",
    title: "Optimized the tables around the game on mobile",
    items: [
      "Optimized the tables around the game on mobile.",
    ],
  },
  {
    date: "2026-07-21",
    title: "Crests for every Spanish club",
    items: [
      "Up till now England was the only country with real crest art, and everyone else just got the two-color swatch. I made crests for all 40 of Spain's clubs, both divisions, so they now show up wherever the club's name does instead of the plain swatch. That includes the big names I hadn't gotten to yet (Madrid, Barcelona Halcones, Valencia) and finishes off the last stragglers, so Spain's completely done now. Italy, Germany, France and Portugal are still on swatches, but I'll keep chipping away at them.",
    ],
  },
  {
    date: "2026-07-21",
    title: "Fixed the scout always saying \"take it\" on incoming offers",
    items: [
      "Someone pointed out that the scout's one-line take on Incoming Offers said \"that's a great deal, take it!\" on basically every offer, which made it useless. Turned out I was comparing the offer to what the player's worth to your own club, but the buyers only ever make an offer that already clears that number, so of course it always looked like a great deal.",
      "Now the scout weighs the offer against the player's open-market value instead, so the take actually varies: a genuinely big offer gets a \"take it,\" a middling one gets a suggested counter price, and a lowball gets brushed off. Same as before, how reliable the read is still tracks your scouting spend, so a stingy scouting budget gives you a fuzzier take.",
    ],
  },
  {
    date: "2026-07-21",
    title: "You have to set your scouting budget every season now",
    items: [
      "Scouting is one of the most important sliders in the game and I had a feeling a lot of people were just never touching it, coasting on whatever they set once (or the default) forever. It shapes how accurate every transfer value and potential read is all year, so ignoring it is a real handicap.",
      "So now when you advance to a new season, instead of jumping straight into it, the game stops you on a Set Scouting Budget screen. It lays out what the money actually buys you, you pick your number for the year, and then it kicks off the season. You can't skip it, so at least once a year you're consciously deciding how much to spend. It's the same budget it always was, just no longer easy to forget about.",
    ],
  },
  {
    date: "2026-07-21",
    title: "Finance rework",
    items: [
      "A lot of AI clubs were just sitting on piles of cash and never buying anyone, which isn't how a real manager thinks. The reason was the market only ever did a deal if the player was a straight up bargain for the buyer, so decent-but-fairly-priced players never moved.",
      "So now if a club has real money to spend and an actual gap on its roster (either it's short of bodies at a position, or its best guy there is a clear weak spot), it'll pay a fair price to fill that hole instead of holding out for a steal. It'll also dig a bit deeper into its cash to get the deal done. It still keeps a reserve so nobody bankrupts themselves.",
      "While I was in there I also tightened the money supply. Clubs were swimming in cash because the base allocation every club gets each season was way more than they could ever spend, so it just piled up. I cut that base allocation from $110M to $88M across the board (second division too, scaled the same way).",
    ],
  },
  {
    date: "2026-07-21",
    title: "Cleaned up the Match Rating leaderboard",
    items: [
      "The Match Rating leaderboard was getting cluttered with guys who only played a game or two. Match Rating is an average, so if someone came off the bench once and had a blinder, his one great score would rocket him to the top of the chart above players who'd been great all season. That's silly, so now you need to have played at least half of the games so far to show up on the Match Rating boards (both the full Stat Leaders page and the little leaders box on the Dashboard).",
    ],
  },
  {
    date: "2026-07-21",
    title: "Transfer rows stick around after a deal closes",
    items: [
      "Small annoyance I kept hitting: when you bought a player on the Transfers page, or accepted an offer for one of yours on Incoming Offers, the row would just blink out of the list and you'd be left wondering if it actually went through. Now the row stays put and turns into a little \"Transferred\" (or \"Sold to <club>\") tag for the rest of the window, so you get a clear confirmation instead of a disappearing act. The window summary lists are still down at the bottom too.",
    ],
  },
  {
    date: "2026-07-20",
    title: "The best players just aren't for sale anymore",
    items: [
      "When I made star players hard to buy a couple days ago, I did it by cranking their asking price into the billions so no club could ever afford them. It worked, but it was ugly. Seeing a guy valued at 900 million just looks broken, and it's not how football actually works. Man City would never sell Haaland, and it's not because you can't scrape together the cash, it's because he's simply not for sale.",
      "So I redid it properly. Transfer values are now capped at 350 million, so you'll never see a silly fantasy number again. Instead, the genuinely elite players on the genuinely good clubs are just taken off the market. Specifically: if a player was one of the best in the world last season (either a really high rating, or he won Player of the Season, the Golden Boot, or made the Team of the Season) and his club finished in the top four of a top-flight league, he's not for sale to anyone, you or the AI. He won't show up in your recommended targets and any offer you make gets ignored.",
      "The upshot is the same as before, you still can't just buy a title-winning squad, but now the reason makes sense and the numbers you see are believable. If you want those players, you develop them or you catch one at a club that had a down year.",
    ],
  },
  {
    date: "2026-07-20",
    title: "Reworked the Continental Cup into a Champions-League-style league phase",
    items: [
      "Before the cup was a straight sixteen team knockout, but France and Portugal only got 1 team each and they had to play in a play-in game. This kinda sucked so I rebuilt the whole thing. It is now modeled like the modern Champions League with the league format.",
      "It's now 20 clubs. The big four still send their top four, but France and Portugal each send their top two now instead of just the champion. Everyone starts in one big league phase and plays six games, and the draw is balanced with pots so nobody randomly gets six giants or six easy games (and you never draw a club from your own league). After six rounds the table splits: top four go straight to the quarter-finals, 5th through 12th play a one-off playoff for the last four spots, and 13th through 20th are out. Then it's quarter-finals, semis and final like before.",
    ],
  },
  {
    date: "2026-07-20",
    title: "Stopped the free-agent flip, and made free agents harder to grab",
    items: [
      "Someone on Reddit pointed out you could sign a free agent for nothing and then immediately sell him for a big transfer fee, which is a pretty broken way to print money. So now when you sign a free agent onto your senior team, you're committed to him for a season before you can sell him. No club will bid on him until then, and the Roster page tells you he's not sellable yet instead of showing the List for Transfer button. You can still release him for free whenever you want, you just can't cash him in right away.",
      "While I was at it I made the free-agent pool worse to shop. The AI clubs now pick through it before you do, and they'll grab any genuinely useful free agent to upgrade a spot they've already got covered, not just to plug a hole. So by the time you get to the Free Agents page, most of the good ones are already gone and what's left is mostly squad filler. You'll still stumble on the odd bargain, but don't count on it.",
    ],
  },
  {
    date: "2026-07-20",
    title: "Fixed how easy it is to get good off the transfer market",
    items: [
      "Me and a few people noticed that this game was a little too easy. I personally led a bad D2 team to a D1 championship in like 10 seasons. So I essentially just raised AI's asking price for their star players. Now it is quite hard to buy a player who is over 76 OVR.",
      "I'm trying to find a balance between making the game too easy and making the game too hard, because neither are fun to play.",
    ],
  },
  {
    date: "2026-07-20",
    title: "Moved the \"Copy AI Prompt to Customize\" button",
    items: [
      "I moved the \"Copy AI Prompt to Customize\" button (the one that helps you import real teams) up into the top bar while you're in a save, instead of tucking it away on each save's row on the Leagues screen. Export Teams and Import Teams are still on the Leagues screen.",
    ],
  },
  {
    date: "2026-07-20",
    title: "Individual player finishing now plays a bigger part in the engine",
    items: [
      "Previously, the engine was calculating shot conversion percentage based on a composite of all the attackers' stats on average. Now the stat of the person taking the shot matters individually.",
    ],
  },
  {
    date: "2026-07-20",
    title: "Import real teams and players from a file",
    list: true,
    items: [
      "A lot of you asked to bring real teams into the game, so now you can. Every save on the Leagues screen has \"Export Teams\" and \"Import Teams\".",
      "Export Teams downloads a plain text (JSON) file listing every club in your world, grouped by league. Edit it however you like, or hand it to an AI and ask it to fill in a real league, then load it back with Import Teams. It matches clubs to your leagues by slot, so it's the easiest way to turn the fictional default world into real ones.",
      "Rename in bulk: change a club's name, abbreviation, and colors from the file instead of one at a time (same as Customize Teams). Include only the leagues you care about and leave the rest alone.",
      "Bring in real squads: a club can also carry a list of players. Give each one a name, position, and age, plus either an overall (the game builds ratings to match) or exact ratings for full control. List as many or as few as you want, whatever you leave short is topped up with reserves so the team is always playable. Importing a squad replaces that club's players, so it's best done on a fresh save.",
      "Don't want to write JSON by hand? Hit \"Copy AI Prompt to Customize\" and it copies a ready-made prompt, already filled in with your world's league names and sizes, that teaches ChatGPT or Claude exactly how to build the file. Paste it, ask for the leagues you want, and save the reply.",
    ],
  },
  {
    date: "2026-07-20",
    title: "God Mode: a sandbox for building your dream league",
    list: true,
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
      "A lot of you asked for more leagues, so I added France and Portugal, each with their own two divisions. That brings the world up to six countries and 240 clubs.",
      "I made both of them weaker than the four leagues you already know, with Portugal the weakest, and gave their clubs smaller budgets. So they mostly sell their best players off to the richer leagues instead of buying. They're in the Continental Cup too, but only each country's champion gets in, and even then it has to win a play-in round first to reach the main 16-team bracket.",
    ],
  },
  {
    date: "2026-07-20",
    title: "See your Starting XI's stats at a glance",
    items: [
      "A few of you pointed out that you could see season stats for your bench players but not for anyone in your Starting XI. Good catch. So I added a stats table for the Starting XI right below the pitch on the Roster page, with the same columns as the bench table (appearances, minutes, goals, assists, tackles, rating and more). Now you can read every starter's season without pulling him off the pitch.",
    ],
  },
  {
    date: "2026-07-20",
    title: "Easier lineup swaps on mobile",
    items: [
      "I saw a lot of you struggling to move players in and out of the Starting XI on mobile, since drag-and-drop doesn't really work on phones. So now you can just tap the four dots on the left side of a player, then tap a spot in the Starting XI (or another player) to swap them in. Drag-and-drop still works if you're on a computer.",
    ],
  },
];
