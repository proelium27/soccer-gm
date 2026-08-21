import type { ReactNode } from "react";
import { useSportName } from "../sportName.js";

/**
 * The in-game manual: player-facing documentation of every shipped feature,
 * modeled on the Basketball GM manual's single-page, plain-spoken format.
 *
 * This page doubles as the project's feature ledger — when a feature ships,
 * changes, or is removed, update the relevant section here in the same PR
 * (see the "In-game Manual" section of CLAUDE.md). Numbers quoted below are
 * the live values from src/core/constants.ts at the time of writing; if you
 * retune a constant, fix its mention here too.
 */

const SECTIONS: [id: string, title: string][] = [
  ["overview", "Overview"],
  ["difficulty", "Difficulty"],
  ["pages", "The Pages"],
  ["season", "The Season & Simming"],
  ["world", "The World"],
  ["cup", "The Continental Cup"],
  ["shield", "The Continental Shield"],
  ["domestic-cup", "The Domestic Cup"],
  ["international", "International Football"],
  ["players", "Players: Ratings, OVR & Potential"],
  ["development", "Player Development & Aging"],
  ["matches", "The Match Engine"],
  ["squad", "Your Squad: Lineups, Depth & the Roster Cap"],
  ["transfers", "Transfers & Negotiation"],
  ["loans", "Loans"],
  ["contracts", "Contracts, Wages & Free Agents"],
  ["finance", "Finance"],
  ["youth", "The Youth Academy"],
  ["ai", "How AI Clubs Think"],
  ["strategy", "Strategy"],
  ["frivolities", "Frivolities"],
  ["godmode", "God Mode"],
  ["faq", "FAQ & Known Quirks"],
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mb-4">
      <h5 className="mt-4">{title}</h5>
      {children}
      <div><a href="#toc" className="small text-muted">Back to top ↑</a></div>
    </section>
  );
}

export function Manual() {
  const { brand, term } = useSportName();
  const sport = term.toLowerCase();
  return (
    <div className="container-fluid p-3">
      {/* h1, styled as an h4. The manual is reachable (and indexable) without a
          save loaded, so it needs one real top-level heading — but it should
          still look like every other page title in the app. */}
      <h1 className="h4">Manual</h1>
      <div style={{ maxWidth: "56rem" }}>
        <p className="text-muted">
          Everything about how the game works, in one place. It won't spoil anything hidden.
          Where the game keeps a secret (like a club's asking price), the manual tells you the
          secret exists and how it behaves, not what the number actually is.
        </p>
        <p className="text-muted">
          Want a quick reminder while you're playing? Look for the little <strong>?</strong> next
          to a heading or a column like Potential, Scout value, or Power, and hover (or focus) it
          for a one-line explanation. This manual is just the full version of those hints.
        </p>

        <div id="toc" className="card mb-3">
          <div className="card-body">
            <h6>Contents</h6>
            <ul className="mb-0">
              {SECTIONS.map(([id, title]) => (
                <li key={id}><a href={`#${id}`}>{title}</a></li>
              ))}
            </ul>
          </div>
        </div>

        <Section id="overview" title="Overview">
          <p>
            {brand} is a single-player {sport} management sim, and you run one club in a 20-team
            league. You pick the starting XI, buy and sell players, haggle over transfers, deal
            with contracts and the wage bill, and try to build a squad that actually wins. This
            season, or three seasons out. Your call.
          </p>
          <p>
            The other 19 clubs are run by AI managers doing all the same stuff you are. They value
            players, buy, sell, renew contracts, and bring up youth, each one driven by its own
            situation rather than some script (there's a whole section on this: <a href="#ai">How
            AI Clubs Think</a>).
          </p>
          <p>
            There's no way to actually "win" {brand}. The game never ends. Win the league, then go
            win it again. Or blow the whole thing up, hoard teenagers, and build a dynasty straight
            out of the academy. Everything runs locally in your browser and saves on its own, and
            you can keep a bunch of league saves going at once and hop between them from the Leagues
            screen. When you start a league, "Start Customized League" lets you rename every club
            and set its colors and abbreviation before the save's created, and "Customize Teams" on
            any existing save does the same thing later.
          </p>
          <p>
            Saves live in your browser, so they don't follow you to another browser or another
            computer on their own. Each save on the Leagues screen has "Export Save", which downloads
            that whole save as a file — every club, player, stat and transfer, exactly as it stands —
            and "Import" at the bottom of the same screen loads one back. An import always comes in
            as a new save alongside what you already have, so bringing in a file can't overwrite a
            league you're in the middle of; if you meant to replace one, delete the old one
            afterwards. Worth knowing: the file is a snapshot, not a live backup, so re-importing an
            old export gives you the save exactly as it was the day you exported it.
          </p>
          <p>
            Exported saves are compressed, so they come out as a <code>.json.gz</code> file that's
            roughly sixteen times smaller than it would otherwise be — an eight-season save lands
            around 5 MB instead of 84 MB, which is the difference between a file you can send someone
            and one you can't. Nothing is left out to achieve that; compression is reversible, and
            importing gives you back every last detail. There's no need to unzip it yourself, and you
            shouldn't: Import takes the file exactly as it downloaded. Saves exported by older
            versions of the game are plain <code>.json</code> and still import fine.
          </p>
          <p>
            That same "Import" button also takes a roster file — a plain text (JSON) file listing
            clubs by league — and works out which kind of file you gave it from the file itself. Give
            it one of those and it starts a brand new save with those clubs in place of the fictional
            ones. You pick your club from the imported teams, so you're choosing between the real
            names rather than guessing which fictional slot is about to become which. Clubs match to
            leagues by slot, and anything the file doesn't cover keeps its original name and squad,
            so you can bring in only the leagues you care about and leave the rest alone. It's the
            easiest way to turn the fictional default world into whatever you want, real leagues or
            otherwise.
          </p>
          <p>
            If you don't have a roster file, the "Download Real Rosters" button next to Import gets
            you one covering every league in the game. It's a separate download rather than part of
            the game, which is why it's a button that fetches it instead of something already built
            in. Two things worth knowing before you look at the squads: the best players come out
            around 80 rather than 90, because ratings are rescaled onto the spread this game is
            tuned for and the ordering matters more than the absolute numbers; and imported clubs
            don't show a crest, since a crest belongs to a team slot rather than a club name and
            would otherwise end up on the wrong team. Colors do carry over.
          </p>
          <p>
            You can hand it more than one file. Select as many as you like at once, or load one and
            then use "Add another file" on the club picker, and they all go into the same league. A
            file per league is usually the sane way to do it, since asking an AI for twelve leagues
            of real squads in a single answer tends to end badly. Files are stacked in the order you
            load them, so if two of them cover the same league, the later one wins and the game tells
            you which it used.
          </p>
          <p>
            Roster files only work when you're starting a league, on purpose. One can replace whole
            squads, and doing that to a save you've been playing would delete the careers, stats and
            transfer history of every player it overwrote. So they're applied at creation and nowhere
            else.
          </p>
          <p>
            A club entry can also carry a <em>players</em> list to bring in a whole squad, not just a
            name. Each player needs a name, position, and age, plus either an <em>overall</em> (the
            game builds position-appropriate ratings to match it) or an exact <em>ratings</em> block
            if you want full control; nationality, height, and potential are optional. You don't have
            to list a full 25 — whatever you leave short gets topped up with lower-rated reserves so
            the squad is always legal to field. Leave the players list off a club and only its name
            and colors change, exactly like Customize Teams.
          </p>
          <p>
            Writing all that JSON by hand is tedious, so the easiest route is to let an AI build it.
            The "Copy AI Prompt to Customize" button in the top bar (once you're in a save) copies a ready-made
            prompt to your clipboard, already filled in with your world's exact league names and sizes.
            Paste it into ChatGPT or Claude and tell it what you want in there. Real present-day
            leagues are the obvious use, but nothing about it is limited to that: ask for a 2004
            throwback league, all-time national XIs, clubs from a show you like, or a world you made
            up entirely. Then save its reply as a <code>.json</code> file and start a league with it
            using "Import" on the Leagues screen. (If your browser blocks clipboard access, the button
            downloads the prompt as a text file instead.)
          </p>
          <p>
            England's and Spain's clubs all have real crest art that shows up wherever the club's
            name does. Every club without one yet (Italy, Germany, France, Portugal, Belgium and
            Turkey) just shows a two-color swatch until it gets a crest of its own. Clubs that came
            in from a roster file always show their colors rather than a crest: the artwork belongs
            to the club that shipped in that slot, not to the one you imported over it.
          </p>
        </Section>

        <Section id="difficulty" title="Difficulty">
          <p>
            You pick a difficulty when you create a league, and it's fixed for that save. There are
            four: <strong>Easy</strong>, <strong>Normal</strong>, <strong>Hard</strong> and{" "}
            <strong>Brutal</strong>. Normal is the game exactly as it's tuned, so if you'd rather not
            think about this, take Normal and skip the rest of this section.
          </p>
          <p>
            The important thing to know is what difficulty <em>doesn't</em> do. It never touches the
            rest of the world. AI clubs buy and sell each other's players at the same prices, their
            academies produce the same players, and the leagues stay exactly as strong as they'd
            otherwise be. Every knob below applies to your club and only your club, so a hard save is
            a harder job in the same world, not a different world.
          </p>
          <p>Four things change:</p>
          <ul>
            <li>
              <strong>Money</strong>. Your club earns more or less than it otherwise would, and can
              bank more or less. Wages cost you exactly what they cost everyone else, which is the
              part that bites: on the harder levels a big squad's wage bill can outrun what the club
              brings in, and then you're losing money every season until you sell someone.
            </li>
            <li>
              <strong>Your academy</strong>. Your youth intake comes through stronger or weaker.
              Everyone else's is untouched, so on Brutal you're developing worse kids than the club
              finishing next to you.
            </li>
            <li>
              <strong>What you pay</strong>. Asking prices are marked up or down for you. Selling
              isn't affected, and neither is what anything is worth on paper, just the fee you're
              asked for when you go and buy someone.
            </li>
            <li>
              <strong>Who'll sell to you</strong>. The best players at the best clubs are already off
              the market (see <a href="#transfers">Transfers</a>). On the harder levels that net is
              cast wider for you, so more of the game's best players simply aren't available and you
              have to develop your own. On Easy it barely applies at all and you can go buy whoever
              you like. When a player is out of reach because of your difficulty, the game says "not
              available to you" rather than pretending his club won't sell, because his club might
              well sell him to somebody else.
            </li>
          </ul>
          <p>
            Scouting is also fuzzier on the harder levels: potential estimate bands are wider and
            take longer to sharpen up, so you're making decisions with worse information.
          </p>
          <p>
            <strong>You can go broke.</strong> There's no debt system and nobody bails you out. If
            your balance goes negative you simply can't sign anyone until it's positive again, and
            your scouting is stuck at zero while you're overdrawn, which makes potential even harder
            to read. It's recoverable, but you recover by selling. On Brutal that's less a warning
            than a description of the job.
          </p>
        </Section>

        <Section id="pages" title="The Pages">
          <p>Every screen in the game and what it's for:</p>
          <ul>
            <li><strong>Dashboard</strong>. Your current W/D/L record and next fixture front and center, with your division's standings on the left and the latest news headlines on the right. Below that, a Stat Leaders section splits league-wide leaders from your own squad's leaders across a few key stats, and below that a finances snapshot with the scouting-spend slider and the sim controls.</li>
            <li><strong>Standings</strong>. The league table, plus each club's current OVR/POT. A season dropdown lets you pull up any past season&apos;s final table next to the current one. The champion&apos;s row is highlighted, and the <a href="#cup">Continental Cup</a> and <a href="#shield">Continental Shield</a> qualification places are shaded.</li>
            <li><strong>Continental Cup</strong>. The live league-phase table and knockout bracket for the current season, plus past winners via a season dropdown. More in <a href="#cup">The Continental Cup</a>.</li>
            <li><strong>Continental Shield</strong>. The same page for the second competition, for clubs finishing just below the Cup places. More in <a href="#shield">The Continental Shield</a>.</li>
            <li><strong>Domestic Cup</strong>. Every round of your country&apos;s cup as it&apos;s drawn and played, with a dropdown for any other country and for past seasons. More in <a href="#domestic-cup">The Domestic Cup</a>.</li>
            <li><strong>National Teams</strong>. A whole section for the summer's national-team football: the current World Cup, Qualifying and Confederation Cups (the Euro, Copa América and AFCON), Rosters showing every nation's named squad, a Schedule of fixtures, Power Rankings of every nation, Stat Leaders (top nations and top players, filterable by country), and History with past winners and each nation's record. More in <a href="#international">International Football</a>.</li>
            <li><strong>Power Rankings</strong>. Every club in the world ranked by a blended Power score: squad OVR (Starting XI plus bench, depth-weighted, same formula as Standings' OVR column) plus a current-season form bonus or penalty. Form isn't just your record. Beating a strong side counts for more than beating a weak one (and losing to a weak side hurts more than losing to a strong one), and goal difference factors in too, so a club can rank above or below its raw OVR depending on how it's actually playing. Record, goal difference, OVR, and the blended Power score all sit side by side, with a badge showing each club's competition and its rank within it. Click a team to expand its full roster in place. The rankings also get snapshotted every 5 matchdays (plus once after the final matchday), and a dropdown lets you browse any past snapshot from any season, with arrows showing how far each club rose or fell since the last one. Historical views can't expand rosters, since past squads aren't stored, and snapshots only start piling up from the point this feature shipped.</li>
            <li><strong>Schedule</strong>. Every matchday's fixtures and results. Click a played match for its box score.</li>
            <li><strong>Stat Leaders</strong>. A Players tab (league-wide leaderboards for one season at a time: goals, assists, shots, shots on target, xG, tackles, interceptions, passes, crosses, fouls, yellow cards, red cards, saves, clean sheets, minutes, and average match rating, with a season dropdown covering the current season and every completed one) and a Teams tab (the same stats plus possession, goals against, and xG against, totaled per club, with its own season dropdown). Match rating is an average rather than a running total, so to keep a one-off cameo from topping the chart a player needs to have appeared in at least half of the games played so far before he shows up on the match-rating board (a threshold that scales as the season goes, so it works ten games in as well as at the end). A <strong>Totals / Per 90</strong> switch sits next to the stat dropdown: Per 90 divides each stat by the number of full matches the player's minutes add up to, which is how you find the squad player outproducing a starter rather than just the one who played most. Per-90 mode has a playing-time floor of its own &mdash; 30% of the minutes available so far, quoted above the table &mdash; because a rate is far easier to fluke than a total: score in a twelve-minute cameo and you've "scored" 7.5 per 90. It's counted in minutes rather than appearances, since twenty run-outs off the bench is exactly the case an appearance count would wave through. Appearances, minutes and match rating stay as totals either way (the first two are what the rate divides by, and a match rating is already an average). For career totals and all-time bests across every season at once, see <a href="#frivolities">Frivolities</a>' All-Time Leaders.</li>
            <li><strong>Awards</strong>. Two tabs. World gives the Ballon d'Or for the best player in the world that season (with a top-10 shortlist and a breakdown of where his points came from) and a World Team of the Year pitch view. By league gives Player of the Season, the Golden Boot, and a Team of the Season pitch view for one competition. Both have a dropdown to browse past years.</li>
            <li><strong>Club History</strong>. A per-club honours page (yours by default, with a dropdown for any club in the world): a trophy case (league titles, second-tier titles, Continental Cups, domestic cups, any trebles, promotions and relegations), individual honours won by the club's players (Player of the Season, Golden Boot, Team of the Season selections), franchise records (best finish, most points and wins in a season, all-time record), and a season-by-season table of every completed season (each season's note also shows how far the club got in that year's Continental Cup and domestic cup).</li>
            <li><strong>A club in one season</strong>. Click any club anywhere in the game &mdash; a table, a transfer, the club beside a season on a player's profile &mdash; and you land on what that club did that year: the squad, where it finished and its record, how far it got in the domestic cup, the Continental Cup and the Continental Shield, and where the Power Rankings had it at the end. A dropdown walks you through the club's other seasons. Two things to know about an old squad. It's who <em>finished</em> the season there, so a player sold in January shows up at his new club and not his old one. And players who retired long ago may be missing altogether, because the game only keeps a permanent career record for the ones worth remembering &mdash; the rest are gone for good. Retirees who are still on record show their appearances and the rating they played at, but not their goals and assists for that year, which aren't kept.</li>
            <li><strong>Frivolities</strong>. All-time lists that don't affect play: GOAT rankings for players and clubs, an awards record book (most Ballon d'Ors, World Team of the Year places, Players of the Season, Golden Boots and Team of the Season places, the highest-scoring individual seasons ever, and awards by club and country), all-time records (most dominant and worst team seasons, highest rating ever reached, longest careers, biggest transfer fees), All-Time Leaders (the top 10 in every stat at a glance, click through for the full board, career totals or best single seasons, world-wide and including retired players), an international record book (most caps, international goals and World Cups won, laid out the same way and filterable by country), player bios (oldest, youngest, where players come from, one-club men, name oddities), and club records (trophy cabinet, longest title droughts, biggest spenders and best traders). More in <a href="#frivolities">Frivolities</a>.</li>
            <li><strong>Season Preview</strong>. A snapshot of how the offseason shook out: the league's top 10 highest-rated players, top 10 highest-rated teams (both by OVR), the top 10 biggest transfers from the summer window ranked by fee, and who <a href="#development">retired</a>. It opens automatically the moment you advance past a season, with a link through to Awards.</li>
            <li><strong>News Feed</strong>. Every completed transfer in the league (AI-to-AI deals included) plus player accomplishments (hat-tricks, a standout performance each matchday, and goal milestones every 10, season and career) all woven into one timeline per season, with club and season filters. Your club's items are highlighted.</li>
            <li><strong>Roster</strong>. Your squad: your Starting XI on a pitch view (with an optional Depth Chart overlay), a stats table for the XI, and a bench table (both with ratings, ages, contracts, and season stats, and goalkeepers also show goals against and xG against). Drag a bench player onto a pitch slot to swap him into the XI, drag one starter onto another to switch their positions, extend contracts, or release players.</li>
            <li><strong>Transfers</strong>. Recommended targets you can actually afford, plus your live negotiations. Make offers, read counter-offers, close deals.</li>
            <li><strong>Incoming Offers</strong>. AI clubs bidding for <em>your</em> players. Accept, reject, or counter to push the fee upward.</li>
            <li><strong>Loans</strong>. List your own players for a fixed-length loan, look over AI clubs' incoming loan offers, and keep track of who's currently out on loan.</li>
            <li><strong>Finance</strong>. Budget, the full wage-bill table, a projected (or final) season settlement, your transfer history, and a league-wide money table.</li>
            <li><strong>Incoming Talent</strong>. Unsigned prospects age 21 or younger. Sign them to your senior team or into your academy.</li>
            <li><strong>Free Agents</strong>. Every other unsigned player, sign straight to your senior team. The default view shows the best across every position but caps how many of any one position it lists, so a spot that always has lots of free agents (defensive and attacking mids only get two roster spots per club, so their good extras spill into free agency more often) can't crowd out the rest. Pick a position from the dropdown to see that position's full list.</li>
            <li><strong>Academy</strong>. Your club's youth-academy holding pool: extend, release, or promote to the senior team.</li>
            <li><strong>Box Score</strong>. Per-match detail, in three parts. The scoreboard at the top names the competition and matchday and starts the Man of the Match, the highest-rated player among those who actually played. Under it, a head-to-head strip compares the two sides on possession, shots, shots on target, xG, corners and fouls. Then a full-width stat table per club (xG, passes completed/attempted, crosses and fouls, goals against and xG against on the goalkeeper's row, and a 0&ndash;10 match rating for everyone who appeared), grouped into attacking, keeping, defending, passing and discipline blocks. The play-by-play at the bottom runs down a timeline with one club on each side, showing goals, cards, substitutions, penalties and injuries by default; switch it to "Every event" to add every shot and corner too.</li>
            <li><strong>Leagues</strong>. Your saved leagues. Create, enter, or delete saves. Each one is fully independent. Every save is named after the club you took over, so the row also shows the season it's reached and when you started it, which is how you tell two saves of the same club apart.</li>
            <li><strong>Player Profile</strong>. Click any player's name anywhere in the game (Roster, Stat Leaders, Awards, Transfers, News Feed) to open his full career page: every attribute rating, individual and team honors (Ballon d'Or, World Team of the Year, Player of the Season, Golden Boot, Team of the Season, league titles), a season-by-season stat line with columns you won't see elsewhere (shots on target, xG, goals against/xG against for keepers, yellow and red cards) that carries the same Totals / Per 90 switch as Stat Leaders &mdash; on the Cup tab as well, but not on national-team stats, where caps are recorded without minutes and so have no per-90 reading &mdash; full transfer history, a transfer-value-over-time chart, and a season-by-season OVR/POT/attribute history. The value chart plots what he's worth on the market against the seasons he's played, with the line colored by whichever club he was at and club crests marking transfers. Hover any season for a card with his value that year, his age, his OVR and POT, his goals and assists, his appearances, his average match rating, and the club he was at, where a youth-academy year reads as "Club (Academy)". A Value/OVR switch in the corner of the panel flips the same chart to his rating over time, which is worth a look on an older player: a veteran's OVR can sit flat for years while his value falls away underneath it, because the market is paying for the seasons he has left as much as for how good he is. His ratings only move in the offseason, so there's one real value per season and the line between them is just a smooth join, not extra readings. The value is worked out from the same numbers the market uses, which includes his potential &mdash; so if your scouts still only have a range on his POT, the chart is priced off that range rather than the real number, and it sharpens as they do.</li>
          </ul>
        </Section>

        <Section id="season" title="The Season & Simming">
          <p>
            A season is a double round-robin: 38 matchdays from August to May, every club playing
            every other home and away. A win is 3 points, a draw is 1. Alongside the league, the
            world's best clubs fight it out in the <a href="#cup">Continental Cup</a> on fixed
            matchdays. Every save's first season shows as 2026, and it ticks up a year each time
            you go to the offseason.
          </p>
          <p>
            <strong>Historic seasons.</strong> Every so often, a club's whole season just clicks.
            Or completely falls apart. A rare hidden form swing can carry a squad well above (or
            below) what its ratings say, for one season only. It's where the runaway record-points
            champion comes from, and the collapse nobody saw coming. It's season-long and it stays
            in that season. Ratings, values, and wages don't change, and next year the club is
            right back to its true level. Your club is just as eligible as any other, both
            directions.
          </p>
          <p>
            You sim from the Dashboard (or the Sim menu in the top bar) in whatever chunk you want:
            one game, the rest of the season, or a distance you pick yourself &mdash; either{" "}
            <strong>sim to matchday</strong> a number, or <strong>sim this many matchdays</strong>{" "}
            forward. The line under the box tells you what you're about to play, how many matchdays
            that is, and what month it lands in, so you can stop anywhere: the game before a big
            cup tie, the last matchday of a month, or matchday 21 to land on{" "}
            <strong>deadline day</strong> with the winter transfer window still open. Matches
            involving your club use your saved starting XI.
          </p>
          <p>
            <strong>Watching a match.</strong> Next to Sim One Game there's <strong>Watch Next
            Game</strong>, which plays your club's match out a minute at a time instead of jumping
            to the result: a running clock, the events as they happen, and the rest of your
            division's scores and the live table down the right. You can pause, run it at 1x, 2x or
            4x, or skip to the final whistle, and the <strong>Every chance</strong> switch decides
            whether you see every shot or only the goals, cards, subs, penalties and injuries. To
            see one again later, open its box score and hit <strong>Watch it back</strong>.
          </p>
          <p>
            Cup ties can be watched too. Continental Cup rounds land on league matchdays, so on
            one of those you have two matches: the game asks which you'd rather watch, and plays
            both either way &mdash; the one you skip still has its box score. A league-phase match
            shows the Swiss table beside it instead of your league table, and a two-legged
            quarter-final or semi-final is watched a leg at a time, the second leg at the other
            club's ground.
          </p>
          <p>
            The match is played the moment you press the button, and what you're watching is the
            recording of it, so watching never changes the result. It also means the matchday isn't
            saved until you close the viewer: quit halfway and it simply hasn't happened, and
            playing it again gives you the same match. You can't make substitutions while you watch
            yet, and possession and xG appear only at full time (they aren't tracked minute by
            minute).
          </p>
          <p>After matchday 38, the offseason runs on its own, in this order:</p>
          <ol>
            <li>AI clubs renew expiring contracts for players they still rate (<a href="#ai">details</a>).</li>
            <li>Contracts that didn't get renewed expire, and those players become free agents.</li>
            <li>Every player ages a year and develops (or declines) per the <a href="#development">development model</a>.</li>
            <li>Retirements: veterans from the mid-30s onward, plus players nobody has signed (<a href="#development">details</a>).</li>
            <li>The youth academy delivers each club's new intake (<a href="#youth">details</a>).</li>
            <li>AI clubs sign free agents, both to fill holes and to poach any that upgrade a spot they're already stocked at, then trim their squads back to 25.</li>
            <li>The summer transfer window opens and the AI-to-AI market runs.</li>
            <li>New season: budgets get settled, base allocation in and the full season's wages out (<a href="#finance">details</a>).</li>
          </ol>
          <p>
            Any lingering injuries get healed over the offseason, so anyone still hurt at the
            rollover starts the new season fit.
          </p>
          <p>
            <strong>Jumping ahead.</strong> The <strong>Jump ahead</strong> card on the Dashboard
            plays whole seasons at once &mdash; up to 25 &mdash; with the AI running your club
            while they go by. It's for seeing where a world ends up, or for skipping past a
            rebuild you don't fancy managing. It works mid-season too: it finishes the season
            you're in first, so jumping 1 season always means "get me to next year".
          </p>
          <p>
            While you're gone your club is treated as an AI club in every respect. It picks its own
            formation and XI, buys and sells, renews contracts, signs free agents and trims itself
            back to 25. Other clubs can bid for your players, and your stars are protected exactly
            the way an AI club's are &mdash; by price, not by a veto. If it gets relegated its best
            players can be pulled up to the first division like anyone else's, and your{" "}
            <a href="#squad">saved starting XI</a>, transfer listings and any talks you had open
            are cleared when you hand it over, because nobody's there to finish them.
          </p>
          <p>
            You get the club back at the start of the season you asked for, with a summary of how
            each year went. Two things to know: potential comes back <a href="#players">fogged</a>{" "}
            for anyone signed while you were away (you haven't watched those players), and there's
            no undo &mdash; the only way back to the season you left is a save you exported first.
            A long jump takes a few minutes to play out.
          </p>
        </Section>

        <Section id="world" title="The World">
          <p>
            A new save drops you into one shared world: eight countries (<strong>England</strong>,{" "}
            <strong>Spain</strong>, <strong>Italy</strong>, <strong>Germany</strong>,{" "}
            <strong>France</strong>, <strong>Portugal</strong>, <strong>Belgium</strong> and{" "}
            <strong>Turkey</strong>), each with its own two-division
            pyramid (Division 1 and Division 2, 20 clubs apiece), for 16 leagues and 320 clubs total.
            You pick any club in any country and division when you start.
          </p>
          <p>
            The big four (England, Spain, Italy and Germany) are all built to the same strength and
            budget bands, so none of them is a flagship league above the others. The other four are
            deliberately weaker and poorer: their clubs generate at lower OVR, and they earn and can
            bank less money. They step down in that order —{" "}
            <strong>France</strong>, then <strong>Portugal</strong>, then <strong>Belgium</strong>,
            then <strong>Turkey</strong> weakest of all, and their budgets step down in that same
            order. All four are selling leagues, and Turkey is the poorest as well as the weakest. You
            won't feel it inside their own matches (someone still wins Ligue 1), but it shows up
            wherever leagues meet. Their players are cheaper, so the big four steadily buy up their
            best talent, and they go into every Continental Cup tie at a real disadvantage. Division 2
            in any country generates weaker than its own Division 1, exactly like the real second
            division always has, and that gap is kept real and structural across a whole dynasty (see
            the ceiling mechanism below), not just at the start.
          </p>
          <p>
            <strong>One global transfer market.</strong> The AI transfer market, free agency,
            recommended transfers, and inbound offers for your own players all run across every
            country with no home-country bias. An Italian club can and will buy a Spanish player,
            sign an English free agent, or bid on one of yours, exactly like they're all in one
            league. A strong Division 2 player anywhere in the world can also get pulled up to a
            Division 1 club by the same thing that already applies at home (there's a "Wants a move
            to Division 1" note in <a href="#ai">How AI Clubs Think</a>), and it isn't limited to
            his own country.
          </p>
          <p>
            Promotion and relegation (3 up, 3 down) runs on its own within each country at the end
            of every season, so a rough season in Spain's top flight doesn't touch any other
            country's tables. Standings, Awards, and Stat Leaders each have a competition dropdown,
            grouped by country, so you can browse any of the 16 leagues. It defaults to
            whichever one your own club is currently in.
          </p>
          <p className="text-muted small">
            Saves you created before this feature shipped stay England-only forever. There's no
            mid-save world expansion.
          </p>
        </Section>

        <Section id="cup" title="The Continental Cup">
          <p>
            The Continental Cup is a 24-club competition played alongside the league season.
            Qualification is purely about <strong>league position</strong>, not squad quality. The
            top four clubs in each of the four strongest top-flight leagues (England, Spain, Italy and
            Germany) get in, plus the top two from each of the four weaker leagues,{" "}
            <strong>France</strong>, <strong>Portugal</strong>, <strong>Belgium</strong> and{" "}
            <strong>Turkey</strong>. That's 4×4 + 4×2 = 24 clubs. On
            the <a href="#pages">Standings</a> page the qualifying places are shaded as the
            qualification zone (top four in a strong league, top two in a weak one).
          </p>
          <p>
            It opens with a <strong>league phase</strong>: all 24 clubs sit in one combined table and
            each plays <strong>six games</strong> against six different opponents. The draw isn't
            random. The field is split into a stronger half and a weaker half, and everyone plays
            three from each half, so no club draws six giants or six minnows. You never play a club
            from your own league. Home and away are evenly split, and you play once per league-phase
            round (on matchdays 3, 7, 11, 15, 19 and 23).
          </p>
          <p>
            When the six rounds are done, the table splits three ways. The <strong>top four</strong>{" "}
            go straight to the quarter-finals. Clubs ranked <strong>5th to 12th</strong> drop into a
            single-leg <strong>playoff round</strong> (matchday 27) and the four winners take the last
            four quarter-final places. Clubs finishing <strong>13th to 24th</strong> are knocked out.
            From there it's a straight knockout: quarter-finals, semi-finals and final.
          </p>
          <p>
            The <strong>quarter-finals and semi-finals are two-legged</strong>: each side hosts once,
            on <strong>separate matchdays</strong> (first leg then second leg), and the tie is decided
            on the <strong>aggregate</strong> (both clubs' goals across the two games added up). Two
            matches instead of one, with home advantage cancelling out, let the stronger squad's
            quality actually come through, so cup runs track how good you really are far more than a
            single-game coin flip did. The QF legs are on matchdays 29 and 31, the semis on 33 and 35,
            and the <strong>final is a single match</strong> on matchday 37 at a neutral venue. The
            league-phase <strong>playoff (matchday 27) stays single-leg</strong> too. Your cup
            fixtures show up on your <strong>Schedule</strong> page alongside your league games.
          </p>
          <p className="text-muted small">
            This is deliberately a fairer road in for France and Portugal than a one-off qualifier
            would be: their clubs get in with more places, are guaranteed six games, and only need a
            mid-table league-phase finish to reach the playoff. That said, don't expect miracles.
            The cup reads a weak-league side as genuinely weaker than a big-four side with the same
            league position, not as an equal, so those clubs go in as underdogs and usually have to
            scrap for a playoff spot.
          </p>
          <p>
            Since qualification comes off a finished table, the cup runs a season behind. The first
            Continental Cup is in your world's <strong>second season</strong>, seeded from season
            one's final tables. Season one has no cup.
          </p>
          <p>
            A tie level after its full running time (90 minutes for single-leg ties, or level on
            aggregate after both legs of a two-legged one) goes to extra time, then a penalty shootout
            if it's still level, so every knockout tie ends with a winner (league-phase games can just
            be draws). The league phase and bracket play automatically as the season reaches them, and
            the <strong>Continental Cup</strong> page shows the live table and bracket with your club
            highlighted; each two-legged tie lists both leg scores beneath it.
          </p>
          <p>
            Prize money is real and it's paid as you go. Every club banks a participation fee for
            reaching the league phase, winning a playoff tie pays more, and each knockout round you
            win pays more than the last. Going all the way is worth a serious chunk on top of your
            normal league finances, enough to reshape a transfer budget.
          </p>
          <p>
            Cup matches are their own thing. Goals, assists and appearances there are tracked{" "}
            <strong>separately</strong> from your league stats (they don't feed Stat Leaders, the
            end-of-season awards, or player development). You'll find a club's cup record under the{" "}
            <strong>Cup</strong> tab on any <a href="#players">player's profile</a>.
          </p>
          <p>
            One handy thing: if your club reaches the final, simming to the end of the season{" "}
            <strong>stops just before the final</strong> so you don't blow past it. Check your
            lineup, then sim on to play it.
          </p>
        </Section>

        <Section id="shield" title="The Continental Shield">
          <p>
            The Continental Shield is the second competition, for the clubs that just miss out on the
            Continental Cup. It takes the places directly below the Cup's: <strong>5th and 6th</strong>{" "}
            in each of the four strongest leagues, and <strong>3rd and 4th</strong> in each of the four
            weaker ones. That's 8 × 2 = <strong>16 clubs</strong>, and because it starts exactly where
            the Cup stops, no club is ever in both. On the <a href="#pages">Standings</a> page the
            Shield places get their own shaded band directly under the Cup's.
          </p>
          <p>
            It runs exactly like the Cup: a 16-club league phase of six games, then the top four go
            straight to the quarter-finals, 5th to 12th fight through a single-leg playoff, and the
            rest go out. Quarter-finals and semi-finals are two-legged, the final is one match.
            It uses the <strong>same matchdays</strong> as the Cup, which is fine because no club
            plays in both. Like the Cup it starts in your world's second season, and if your club
            reaches the final the sim stops just before it.
          </p>
          <p>
            The money is real but smaller: participation, a playoff win and each knockout round all
            pay, at roughly <strong>40%</strong> of the Cup's rates. Winning the whole thing is worth
            about what a decent cup run is, not what winning the Cup is. That's the point of it —
            finishing 5th now has something to play for, and a mid-table club can put a trophy in the
            cabinet, without it ever rivalling the Cup.
          </p>
          <p>
            Shield stats are tracked the same way cup stats are, separately from your league season,
            and they show up on the same <strong>Cup</strong> tab of a{" "}
            <a href="#players">player's profile</a> with a column saying which competition each row
            is. Shield titles show on a club's trophy case and count on the all-time boards, weighted
            below a Continental Cup, and a winner's players get a Shield pill on their profile
            alongside their other honours. They don't currently feed the Ballon d'Or. Winning it is
            also not part of the <a href="#domestic-cup">treble</a>: that's the league, the
            Continental Cup and your domestic cup, and the Shield is what you win instead of the
            Cup rather than alongside it.
          </p>
        </Section>

        <Section id="domestic-cup" title="The Domestic Cup">
          <p>
            Every country also runs its own cup, and this one is open to{" "}
            <strong>both divisions</strong> — all 40 clubs in the country, top flight and second
            tier together. It's the trophy that lets a small club have the season of its life, and
            it's the third leg of the <strong>treble</strong>: win your league, the Continental Cup
            and your domestic cup in the same season and you've done the lot.
          </p>
          <p>
            There is no seeding and no bracket. Every round is an <strong>open draw</strong>: the
            clubs still standing go back in the hat, get paired at random, and the club drawn first
            plays at home. You find out who you've got when the previous round finishes, exactly
            once. The two best clubs in the country can meet in round one, and often do.
          </p>
          <p>
            40 clubs doesn't divide neatly into a knockout, so the{" "}
            <strong>16 lowest-placed clubs</strong> from last season play a preliminary round first
            (matchday 5). The eight winners join the other 24 for a round of 32 (matchday 9), then
            it's a round of 16 (13), quarter-finals (21), semi-finals (26) and the{" "}
            <strong>final on matchday 36</strong>. None of those clash with a Continental Cup
            matchday, and your cup fixtures appear on your <strong>Schedule</strong> page.
          </p>
          <p>
            Every tie is a <strong>single match</strong>. Level after 90 minutes goes to extra time,
            and still level goes to penalties, so somebody always goes through on the day. A
            second-tier club really can knock you out: the cup measures both divisions against{" "}
            <strong>one shared yardstick</strong> rather than grading each club against its own
            league, so the gap between a top-flight side and a second-tier one is real — but it's a
            gap, not a wall, and over one match anything can happen.
          </p>
          <p>
            Cup stats are tracked separately from your league stats, under the{" "}
            <strong>Domestic Cup</strong> tab on a player's profile. And as with the Continental
            Cup, if you reach the final the sim <strong>stops just before it</strong> so you can
            take a look at your lineup first.
          </p>
          <p className="text-muted small">
            One thing the domestic cup doesn't do yet: <strong>pay you</strong>. The Continental Cup
            hands out prize money per round, and this one was built the same way, but when I
            measured a 20-season dynasty against one without it, the extra money pushed two of four
            test worlds' poorest clubs into the red late on. The weaker leagues run on thin margins
            and I'd rather a new trophy didn't quietly break their finances, so the payouts are
            switched off until I've tuned them properly. Everything else about the cup works, and
            it costs you nothing to go on a run.
          </p>
          <p className="text-muted small">
            Saves started before domestic cups existed pick them up at the next offseason, so
            there's one season without one. New saves have a cup from season one, since nothing has
            to qualify for it.
          </p>
        </Section>

        <Section id="international" title="International Football">
          <p>
            Your players also represent their countries. National teams play in the summer, on a
            four-year cycle: there's a <strong>World Cup</strong> every fourth season, and the three
            offseasons leading up to it each run a round of <strong>qualifying</strong>. Halfway
            between one World Cup and the next, the same summer as that year's qualifying, the{" "}
            <strong>confederation cups</strong> are played: the European Championship, Copa
            América and the Africa Cup of Nations. Nothing about any of it touches your league
            calendar; it all happens between seasons, and the <strong>National Teams</strong> pages
            are where you follow it.
          </p>
          <p>
            You play it out yourself, a stage at a time. When you reach the offseason, the Dashboard
            hands you the buttons: in a qualifying year you play that year's round of qualifying (one
            of three); in a World Cup year you play the group stage, then the quarter-finals, then
            the semis, then the final, one click each, so you can watch it unfold. A confederation
            cup summer works the same way, except every cup is played side by side: one click
            for all their group stages, then a click per knockout round, and because a smaller
            tournament waits for a bigger one to catch up, every final lands on the same click. If
            you'd rather not linger, "Sim through the World Cup" (or "the cups") plays the
            rest in one go and leaves you on the Dashboard to read the results. And if you don't
            care for it at all, the skip button takes you straight to the offseason. Skipping doesn't cancel
            anything: the games are still played as you advance, on exactly the same results they'd
            have had, and they're waiting on the National Teams pages afterwards.
          </p>
          <p>
            Every nation with enough players in the world enters qualifying. They're split into
            groups by confederation and play a long home-and-away campaign spread over the three
            qualifying offseasons, and the number of places each confederation gets depends on how
            many genuinely strong nations it has, so the 16 who make it are a believable field rather
            than whoever happens to be nearby. At the
            tournament those 16 are drawn into four groups of four; the top two from each go through
            to the quarter-finals, then semi-finals and a final. Knockout ties level after extra
            time go to a shootout, exactly like the Continental Cup.
          </p>
          <p>
            The <strong>confederation cups</strong> have no qualifying of their own: each
            confederation simply takes its strongest nations at the time of the draw, which is the
            order you see on Power Rankings. How big a cup is depends on how much football
            its continent has — Europe fills a sixteen-nation field with four groups and a
            quarter-final, while a confederation with only a handful of real football nations plays
            a single group and sends its top two straight to the final. A confederation that can't
            field even four nations doesn't hold one at all, which is why you'll usually see the
            Euro, Copa América and AFCON and not the others: nearly every player in the world is
            born into one of the eight countries whose leagues you play in, so the rest of the world
            is thin. Fill it out — with an imported roster, say — and those cups start
            being played on their own.
          </p>
          <p>
            <strong>Nobody manages a national team, including you.</strong> Each nation picks its
            own squad from whoever is good enough, in the strongest formation it can field. So your
            job isn't to pick the team, it's to develop players worth picking, then watch how they
            get on. One consequence worth knowing: a squad is chosen from the ratings and injuries
            your players finished the club season with, so a star who ends the year injured really
            does miss the tournament. The whole thing also plays out before anyone retires, so a
            veteran in his final season gets one last crack at it.
          </p>
          <p>
            International football is mostly a record, not a lever. Caps, goals, tournaments played
            and titles won show up on a player's profile and build over his career — confederation
            cups are counted separately from World Cups, so winning the Euro doesn't read
            as winning the World Cup — and the{" "}
            <strong>National Team</strong> tab on his stats card breaks them down campaign by
            campaign, the same way his league and cup seasons are listed. None of it feeds his
            development or his value. There's one real cost, though: if a player gets hurt
            at a tournament, part of the recovery happens over the summer, but a serious injury
            still carries into the new club season and he'll miss its opening weeks (a minor knock
            heals in time). Beyond that it's there to give your players a story beyond your club, and
            to see a golden generation announce itself.
          </p>
          <p>
            You can browse all of it in the <strong>National Teams</strong> section. The World Cup,
            Qualifying and Confederation Cups tabs show the current campaign and let you flip back to
            past years (Confederation Cups shows every cup of a given summer on one page);
            Rosters shows the squad every nation has named for the campaign being played, with the
            eleven it would field highlighted; Schedule lists the fixtures for whatever's being
            played, opening on the qualifying round currently being played (a whole campaign at once
            is hundreds of games, but "All rounds" is there if you want it); Power Rankings sorts every
            nation by squad strength, with movement since last time; Stat Leaders has both the most
            successful nations and the top individual players, which you can filter to a single
            country; and History keeps the roll of past winners plus each nation's tally of titles,
            finals and best finishes. Past editions keep their results and standings, though not the
            match-by-match detail of the current one.
          </p>
        </Section>

        <Section id="players" title="Players: Ratings, OVR & Potential">
          <p>Every player plays one of eight positions:</p>
          <p>
            <strong>GK</strong> goalkeeper · <strong>CB</strong> center back · <strong>FB</strong> full
            back · <strong>DM</strong> defensive midfielder · <strong>CM</strong> central
            midfielder · <strong>AM</strong> attacking midfielder · <strong>W</strong> winger ·{" "}
            <strong>ST</strong> striker
          </p>
          <p>
            Under the hood, every player has 14 individual ratings on a 1&ndash;99 scale: four
            physical ones (speed, strength, stamina, jumping) and ten technical/mental ones (short
            passing, long passing, crossing, dribbling, long shots, finishing, tackling,
            interceptions, positioning, goalkeeping).
          </p>
          <p>
            <strong>OVR</strong> is a position-weighted blend of those ratings. A striker's OVR
            leans on finishing and speed, a center back's on tackling, positioning, and strength.
            The scale is deliberately tight:
          </p>
          <ul>
            <li><strong>65</strong>. An average starter.</li>
            <li><strong>70</strong>. A good starter.</li>
            <li><strong>75</strong>. Usually a team's best player.</li>
            <li><strong>80&ndash;85</strong>. A league-wide elite player.</li>
            <li><strong>90+</strong>. A rare, generational outlier.</li>
          </ul>
          <p>
            <strong>Potential is a scout's guess, not a promise.</strong> The game simulates a
            player's future career a bunch of times and reports the 75th percentile of those peaks,
            so roughly three players in four never quite reach their listed potential, and one in
            four meets or beats it. And here's the important bit: potential has <em>zero</em> effect
            on how a player actually develops. It's a forecast of the development model, not an input
            to it. It also gets re-estimated as the player ages, so it drifts toward his current OVR
            over time.
          </p>
          <p>
            <strong>You don't see a player's exact potential. You see a scouting estimate.</strong>{" "}
            Everywhere POT shows up (Roster, prospects, free agents, transfer targets, rival squads,
            player profiles), it's a low&ndash;high band rather than a single number, and the real
            value always sits somewhere inside that band. Two things tighten the band toward the
            exact figure. First, your <a href="#finance">scouting spend</a>: more scouting means a
            tighter estimate right away. Second, time on your own senior roster: a player you own
            sharpens up on his own over about two to three seasons until his POT is fully known
            (more scouting spend gets you there faster). Prospects, free agents, and other clubs'
            players are never on your roster, so they stay at their foggiest until you scout harder
            or just sign them. Current OVR and individual attribute ratings are always exact. Only
            potential is fogged.
          </p>
          <p>
            <strong>Team OVR and POT</strong> (shown on Standings and at the top of your Roster
            page) aren't a plain average of the whole squad. Just like a genuinely deep squad beats
            a stacked XI with nothing behind it in real football, your starting XI counts in full,
            and each bench player behind them counts for less the further down the depth chart he
            sits. A deep, talented bench really does lift the number, and fringe reserves barely
            move it.
          </p>
        </Section>

        <Section id="development" title="Player Development & Aging">
          <p>
            Players develop each offseason based on age and randomness, and nothing else. The
            typical arc peaks around <strong>age 26</strong>, but not all of a player at once:
          </p>
          <ul>
            <li><strong>Physical ratings</strong> (speed, strength, stamina, jumping) peak earlier and go first. A 30-year-old winger loses his legs before he loses his touch.</li>
            <li><strong>Technical and mental ratings</strong> peak later and fade slower.</li>
            <li><strong>Goalkeepers</strong> age the best of anyone. Their careers routinely run deep into the 30s.</li>
          </ul>
          <p>
            Development is noisy, and way noisier when a player's young. An 18-year-old can jump
            several points in a season (or stall out completely), while a 30-year-old barely moves
            year to year, and mostly downhill. Playing time gives a growing player a little nudge:
            regular minutes help, rotting on the bench hurts a bit, but it never beats the age
            curve.
          </p>
          <p>
            Retirement comes down to two things: how old a player is, and whether anybody actually
            wanted him last season. Age does most of the work. Nobody with a club retires before 33,
            and from there it climbs every year, so even a great player eventually hangs them up.
            But holding a squad place knocks those odds down by about 40%, which is enough that a
            player good enough to keep his place can still be going at 39 or 40, while a fringe
            one his age is long gone. It's never a free pass, though. There's no age at which a
            still-brilliant veteran is safe.
          </p>
          <p>
            The other half is that players nobody signs drift out of the game, at any age. Go a
            full season unsigned and you start rolling to retire whether you're 19 or 35. Two things
            soften that. A contract simply running out doesn't count against you, so a player always
            gets one full free agency to find a club before it starts applying. And genuine young
            prospects are exempt: if a player is still in his early twenties and his ceiling is
            high, he sticks around waiting for his shot no matter how long he's been unsigned. That
            exemption is for prospects only, though. An unsigned 30-year-old is done regardless of
            how good he used to be.
          </p>
          <p>
            You get to see who went. The Season Preview lists the offseason's retirements: how many
            players called it a career, how many of those were on a club's books, and then the
            biggest names to go, with the club they last played for and what they did over their
            career. Anyone your own club loses is always on that list. It only covers the biggest
            names, though, because most of the players who retire in any given offseason are
            unsigned ones nobody would recognize.
          </p>
          <p>
            One thing to know: a retired player is gone from the game, not filed away somewhere.
            There's no career page to visit afterwards, and old transfer entries or news items about
            him lose his name. That Season Preview list is the record of his send-off.
          </p>
          <p>
            What this means for you day to day: the free agent and incoming talent lists churn.
            Journeymen you passed on won't sit there forever, so the bargain bin is thinner and
            older than it used to be. The genuinely promising kids stay put, so you're not on a
            clock with those.
          </p>
          <p>
            <strong>Generational talents.</strong> Development normally gets a lot harder the better
            a player already is, and that resistance is exactly what keeps the league's elite tier
            genuinely rare. But every once in a long while (think years, not seasons), a youth
            prospect shows up somewhere in the world who's just built different. That resistance
            barely applies to him, and he can genuinely climb to heights no ordinary player reaches.
            Nothing announces him, and no badge marks him out. The only tell is the one your scouts
            can actually earn: a potential estimate with a ceiling far beyond what any ordinary
            prospect shows. It's a trajectory, not a guarantee, and a rough run of seasons can still leave
            him merely very good, but these are the players your true legends come from. If one lands
            in <em>your</em> academy, treat him accordingly.
          </p>
        </Section>

        <Section id="matches" title="The Match Engine">
          <p>
            Matches are simulated event by event, and everything below shows up in the box score:
          </p>
          <ul>
            <li><strong>Goals &amp; assists</strong>. Credited to individual players, weighted by who's actually on the pitch and how good they are.</li>
            <li><strong>Passes, crosses &amp; fouls</strong>. Every box score also carries per-player passing (completed / attempted), crosses, and fouls committed. Central and deep players move the ball most, wide players do most of the crossing. These are just stat-sheet detail, they don't change the scoreline.</li>
            <li><strong>Cards</strong>. Yellows, second yellows, and straight reds. Going a man down is a real hit to your side's strength for the rest of the match, and cards now carry a cost past the final whistle too &mdash; see Suspensions below.</li>
            <li><strong>Set pieces</strong>. Corners, and penalty kicks resolved as a duel between the taker and the keeper (saved, scored, or dragged wide).</li>
            <li><strong>Fatigue &amp; substitutions</strong>. Players tire as the match runs, and the coach makes subs around the 60th and 75th minutes, throwing on an attacker when chasing the game. Subs aren't automatic anymore: the coach weighs how good the fresh bench player is against the tired starter he'd replace, and also how that starter is actually playing on the day. A close-quality bench refreshes freely, but he won't pull a good starter for a much weaker reserve unless that starter is genuinely gassed, so a shallow bench leaves your tired legs on. A starter tearing the game up is harder to justify hooking than one having a stinker, even at the same fitness. The coach also cares where a replacement would have to play: he's filling a specific hole in the shape, so a bench striker who'd have to cover at centre-back has to be a lot better to be worth it, and if nobody on the bench fits, the tired starter stays on rather than the shape getting wrecked. The one exception is the chase-the-game sub late on when you're losing, where the coach deliberately changes shape instead, pulling a defender for an attacker who plays his own position. Your matches use the same in-match sub logic. You can also flag any bench player for <strong>More minutes</strong> on the Roster page, which tips the coach toward bringing him on more often.</li>
            <li><strong>Suspensions</strong>. Cards follow a player around. Pick up 5 yellows over the league season and he misses the next match; get sent off for a second yellow and he misses 1; get a straight red and he misses 3. If a sending-off and your fifth yellow land in the same game you serve the longer of the two, not both. Bans only cover league matches, so a suspended player is still available for the Continental Cup, and only league cards count toward them. He shows a red card marker on your Roster and his profile, your Dashboard lists everyone banned, and he's left out of your XI automatically until he's served it. Everything resets when the season does.</li>
            <li><strong>Injuries</strong>. A player can go down mid-match and miss 1&ndash;6 matches. Recovery ticks down as you sim, and he comes back on his own. While he's hurt he shows a red cross on your Roster (both the pitch and the tables) and on his profile, and your Dashboard lists everyone currently sidelined. He's automatically left out of your XI until he's fit.</li>
            <li><strong>Stoppage time</strong>. Scaled to how eventful the half was.</li>
          </ul>
          <p>
            When the XI changes mid-match (a sub, a red card, an injury), the team's effective
            strength is recalculated from who's actually on the pitch, so losing your best center
            back at minute 20 genuinely hurts for the other 70.
          </p>
          <p>
            <strong>Stars carry their phase.</strong> When your side's strength is rolled up for a
            match, the players who actually drive each part of the game count for the most, and a
            genuine standout isn't dragged all the way down to his teammates' level. Your attack
            leans hardest on your strikers and wingers, possession on your central midfielders, and
            your defense on your center backs, so a world-class player in the right spot lifts that
            part of your game noticeably even if the rest of that unit is ordinary. The flip side:
            buying a great player in the wrong position, or padding your OVR with squad filler, moves
            the needle far less than the raw rating suggests. This is why a smart, positionally
            balanced XI can outperform a higher-OVR one that's stacked in the wrong places.
          </p>
          <p>
            <strong>Finishing is individual.</strong> How many chances your team creates comes from
            the whole XI's strength, but whether a given shot goes in also leans on the specific
            player taking it, measured against his own teammates. A striker who's a clear cut above
            the rest of his side will bury chances they'd miss and rack up goals even on a weak team,
            while a poor finisher wastes good ones. It's a redistribution, not free goals: your side's
            best finishers score more than their share, the rest score less, and the league's overall
            scoring stays the same. Corners work the same way off a player's heading. (Your xG stays a
            neutral, team-blind chance quality, so goals well above xG is exactly what a great finisher
            looks like.)
          </p>
          <p>
            <strong>Match ratings.</strong> Every appearance earns a FotMob-style 0.0&ndash;10.0
            rating, starting from a 6.0 baseline and moving with the player's stat line, weighted by
            position. A clean sheet means more to a keeper, and a goal from a defender is worth more
            than a goal from a striker. Short cameos get damped by minutes played, so a two-minute
            sub can't post a 9.8 off one touch. The season-long average is a sortable column on Stat
            Leaders.
          </p>
          <p>
            <strong>End-of-season awards.</strong> The moment you advance past a season, you land on
            the Season Preview page (a quick look at the league's top players, top teams, and
            biggest offseason transfers), with a link through to the Awards page for three honors
            covering the season that just finished. <strong>Player of the Season</strong> starts
            from a player's season-long average match rating, then adds a bonus for his goals and
            assists, weighted heavier than the match rating alone already credits them, and heavier
            still for a defender or keeper who chips in goals, so end product genuinely tips a close
            race and not just consistency. Central and defensive midfielders sit between the two.
            An attacking midfielder counts as an attacker for this, not a midfielder, because in
            this game he scores and creates about as much as a winger does, so his goals are priced
            the same as a winger's rather than at the scarcer midfield rate. The{" "}
            <strong>Golden Boot</strong> is just the league's top
            goalscorer. <strong>Team of the Season</strong> fills an 11-man pitch (one XI slot per
            position) with whoever rates highest at that position across the whole league, blending
            match rating with the stats that matter most for the role: goals and assists up front,
            tackles and interceptions in defense and midfield, saves for the keeper. Both Player of
            the Season and Team of the Season also factor in overall quality, not just the stat
            line, so a modest player who piled up a big statistical season (often just from facing
            heavy pressure on a weaker side) won't out-rank a genuinely elite one. Only players who
            appeared in a decent share of the season's matchdays are eligible for any of the three.
          </p>
          <p>
            <strong>The Ballon d'Or and the World Team of the Year.</strong> The three honors above
            are decided inside one league. The Awards page also has a World tab, which judges every
            league in the world as a single field: the <strong>Ballon d'Or</strong> for the best
            player alive that season (with the nine behind him listed as a shortlist), and a{" "}
            <strong>World Team of the Year</strong> best XI drawn from anywhere. A few things go into
            it. First, the domestic season, scored the same way Player of the Season is, and it's
            still the biggest single part. Second, the Continental Cup: cup goals and assists count
            the same as league ones, your rating in it counts, and there's a bonus for how far your
            club went, biggest by far for winning the thing (all of it scaled down if you only
            played a game or two of the run). Third, everything he played that summer for his
            country: goals, assists and caps, worth double at a World Cup and half again at a
            confederation cup compared with a qualifier. A confederation cup summer counts both the
            cup and that year's qualifying round. Your
            domestic cup counts too, but only as a trophy: winning it is worth points to everyone who
            played in the run, while goals scored in it are not. Those games are only ever measured
            against one country, so unlike Continental Cup games they can't be compared fairly with
            anyone else's, and counting them would quietly favour whoever plays in the weakest
            league.
          </p>
          <p>
            Trophies count for a lot here. Winning your league, winning the Continental Cup,
            winning your domestic cup, winning a confederation cup and being in the squad
            that won the World Cup are all worth real points on top of whatever you did personally,
            and they stack. Roughly speaking, your domestic cup is worth about three league goals to
            a striker, a confederation cup title about nine, winning your league about ten, the Continental
            Cup a bit more than that, and the World Cup more again. The domestic cup is deliberately
            the smallest: it's six games and a bit of luck, and it shouldn't weigh the same as a
            whole league campaign. It isn't a pure team prize: you
            still have to have played a good season yourself, and a squad player who barely featured
            in a cup run only collects a fraction of it.
          </p>
          <p>
            The last thing in the mix is how good the player actually is. The world award leans on a
            player's overall rating noticeably harder than your league's own Player of the Season
            does, and that's deliberate. Every other number in the calculation has been scored
            against the standard of one league, so a rating is the only thing that means the same
            everywhere. Practically, it means the Ballon d'Or usually goes to someone genuinely
            among the very best players alive rather than to whoever had the hottest goal tally, and
            it's the reason the odd midfielder or defender can win it at all. There's a real tension
            between this and the trophy bonuses above, and they're balanced against each other on
            purpose: turn either one up and the other stops mattering. So the leading scorer won't
            always win, a treble winner won't always win, and the very best player won't always win.
            Whoever the season made the strongest case for does.
          </p>
          <p>
            One thing worth knowing about how the world award compares leagues. Match ratings are
            scored against the standard of the league you're playing in, so a 7.5 average in a weak
            league and a 7.5 in a strong one are not the same season &mdash; the first was earned
            against easier opponents. The world award corrects for that by how strong each league's
            players actually are, so the trophy doesn't just drift to whoever plays in the weakest
            division. It's a correction, not a penalty: a genuinely better player in France or
            Portugal still beats a merely good one in England, and the second division is not shut
            out by rule, only by the correction. The Continental Cup is the exception that needs no
            correcting &mdash; everyone in it is measured against the same pooled field, which is why
            it carries the weight it does.
          </p>
          <p>
            <strong>xG (expected goals).</strong> Every shot's chance of going in before you know
            the outcome, based on the defense and keeper it's taken against, tallied up per player
            and per team, shown next to the score on the Box Score page and as a column on Stat
            Leaders. It deliberately ignores the shooter's own finishing skill (an elite finisher's
            shots don't get marked as better chances just because he's elite), so comparing a
            player's actual goals to his xG tells you whether he's finishing above or below what an
            average attacker would from the same chances, instead of the two numbers just tracking
            each other. It's purely informational. It doesn't feed match ratings or anything else,
            it just tells you whether a scoreline flattered a team (or a keeper) or was earned.
          </p>
          <p>
            <strong>Goals against &amp; xG against.</strong> The mirror stat for goalkeepers: how
            many goals he's actually conceded versus how many an average keeper would be expected to
            concede from the shots he faced, shown on his Roster row, his Box Score line, and as Team
            Stat Leaders columns. A keeper conceding fewer goals than his xG against is beating his
            shot-stopping expectation. More means the defense in front of him is doing its job but
            he isn't turning that into saves, or he's just been unlucky. Goalkeepers can't be subbed
            mid-match right now, so both stats always cover a keeper's full 90 minutes.
          </p>
        </Section>

        <Section id="squad" title="Your Squad: Lineups, Depth & the Roster Cap">
          <p>
            Pick your <strong>formation</strong> from the dropdown above the pitch on the Roster
            page. Sixteen shapes are on offer: <strong>4-3-3</strong>, <strong>4-4-2</strong>,{" "}
            <strong>3-5-2</strong>, <strong>5-3-2</strong>, <strong>4-2-3-1</strong>,{" "}
            <strong>4-5-1</strong>, <strong>3-4-3</strong>, <strong>5-4-1</strong>,{" "}
            <strong>4-3-1-2</strong>, <strong>4-4-1-1</strong>, <strong>4-3-2-1</strong>,{" "}
            <strong>4-2-2-2</strong>, <strong>3-4-2-1</strong>, <strong>3-5-1-1</strong>,{" "}
            <strong>5-2-3</strong>, and <strong>5-2-1-2</strong>. It's a real tactical choice, not
            just for show. Your team's match strength is rolled up from whichever eleven the
            formation fields, so a shape that starts two strikers (say 4-4-2) puts a different XI on
            the pitch than 4-3-3. Every shape fields a genuinely different mix of positions, so
            picking one is really picking which of your players get on the pitch: 4-2-2-2 wants two
            attacking mids and two strikers, 5-2-3 wants a back three behind two holding mids, and
            so on. Changing formation resets your Starting XI to the auto-picked best fit for the
            new shape, so you re-arrange from a sensible starting point. If you'd rather not fiddle
            with it, hit the <strong>Best XI</strong> button next to the formation dropdown: it
            picks whichever shape fields your strongest eleven and fills the lineup for you in one
            click, the same way the AI sets up its own clubs. Each AI club automatically lines up in
            whichever shape fields its own strongest eleven, re-checked at the end of each transfer
            window as its squad changes. On the Roster page, your Starting XI sits on
            a pitch, one chip per slot. Drag a bench player from the bench table onto a slot to swap
            him in, and the outgoing starter drops to the bench on its own. You can also drag one
            starter straight onto another to have the two trade positions, so shifting a midfielder
            out wide or pushing a full-back up the flank doesn't mean routing him through the bench
            first. The one pairing the game won't allow is a keeper and an outfielder, since nobody
            else can go in goal. Click a chip to extend or release that player. Below the pitch is a <strong>stats table for your Starting XI</strong>{" "}
            with the same columns the bench table has (appearances, minutes, goals, assists, tackles,
            rating, and so on), so you can read every starter's season at a glance without pulling
            him off the pitch. A <strong>Depth Chart</strong> toggle above the pitch shows each
            starter's current best-fit backup from the bench next to his chip. Each chip also shows
            a small ▲/▼ badge next to a starter's OVR when it changed from last season, green for
            growth and red for decline, so you can spot who's developing or fading without leaving
            the pitch view. Your XI sticks and gets used every match. If your saved XI ever goes
            invalid (a starter is sold, injured, or released), the game quietly falls back to
            auto-picking the best available XI, so you're never fielding a ghost. The bench is the
            best 7 remaining players by OVR. Each bench row has a <strong>More minutes</strong> button:
            flag a reserve you want to see on the pitch more and the coach will lean toward subbing
            him on during matches, even slightly ahead of a marginally better option. It nudges the
            sub decision, it won't force a clearly worse player on.
          </p>
          <p>
            <strong>Playing someone out of position costs you.</strong> Your team's match strength is
            built slot by slot from the shape you picked, so what matters is the job each player is
            doing, not what kind of player he is. Put a centre-back in the striker slot and he
            attacks like a centre-back who has been shoved up front: he drags your attack down, and
            he stops helping your defense, because he isn't back there any more. How much it hurts
            depends on how far you've moved him. Covering a nearby position (a full-back at
            centre-back, a winger at striker) is a modest hit that a good player can absorb. Sticking
            him somewhere unrelated is a real downgrade, and an outfielder in goal is a disaster,
            which is why the game won't let you put one there. Roughly, a good player one position
            out of his own plays like an ordinary player in his proper spot. The upshot is that a
            balanced squad that fills its shape beats a collection of better players crammed into
            the wrong slots, so it's worth checking your XI after injuries pile up. On the pitch view
            anyone lined up somewhere he doesn't play is flagged in amber, showing his position and
            the slot you've put him in, so you're never paying that cost without knowing.
          </p>
          <p>
            <strong>Some players have more than one position.</strong> Look at a player profile and
            you'll see what he'd be rated at each spot he can cover, with his listed position
            highlighted. If he's genuinely good enough at a nearby position for his kind of player,
            it counts as a real second position: it shows next to his name (like "W / FB"), it's
            starred on his rating strip, and he plays there with no out-of-position penalty at all.
            In a new world about a third of players have a second position and only a handful have a
            third, so a proper utility man is worth holding on to. That share climbs over a long
            save, to around half by season 20 or so, and then holds steady: players broaden as they
            develop, and a squad full of veterans really is more flexible than a squad of kids.
            Keepers are always keepers.
          </p>
          <p>
            This matters when the team picks itself. A versatile player counts as a first-choice
            option for every position he actually plays, so a better winger who also plays full-back
            will now take the full-back slot ahead of a weaker specialist, where before the
            specialist always got it. It works the same on the bench: he's a natural pick to come on
            in any of his positions. Versatility isn't a hidden dice roll, it comes straight from his
            attributes, so it can appear or fade as he develops.
          </p>
          <p>
            <strong>Players can change position for good.</strong> A second position says he can also
            do that job. Sometimes a player stops being what he was: if he's been clearly better at a
            nearby position for a few seasons running, not just in one good year, that position
            becomes the one he's listed at. His rating is then worked out as that kind of player, so
            it usually ticks up, and his wage and transfer value follow. You'll see it on the news
            feed for your own players, and his profile keeps the record ("came through at W, moved to
            AM in 2031").
          </p>
          <p>
            You can't order a conversion, and it isn't random either. It comes out of how he's
            developed: as players grow, their strongest attributes get harder to push, so a sharp
            specialist gradually broadens, and now and then he broadens far enough that a different
            job genuinely suits him better. It happens most in a player's early and middle twenties
            and it's uncommon, a handful of players across the world each season, so a converted
            player is worth noticing. New worlds start with nobody miscast, so nothing moves in your
            first seasons. Keepers never convert, and nobody ever converts into a keeper.
          </p>
          <p>
            <strong>Roster cap: 30 players.</strong> Signings, transfer buys, and academy promotions
            are blocked once you're full (the Roster, Transfers, and Incoming Talent pages all show
            an x/30 count). Your academy has its own separate 10-player cap, covered in{" "}
            <a href="#youth">The Youth Academy</a>.
          </p>
          <p>
            <strong>Depth floor.</strong> You can't sell or release a player if it'd leave a position
            with too little cover to put out a team. The game blocks the move rather than letting you
            strand yourself without, say, a goalkeeper. AI clubs play by the same floor.
          </p>
        </Section>

        <Section id="transfers" title="Transfers & Negotiation">
          <p>Two transfer windows per season, just like real football:</p>
          <ul>
            <li><strong>Summer</strong>. The whole offseason plus matchdays 1&ndash;4 (closes early September).</li>
            <li><strong>Winter</strong>. Matchdays 18&ndash;22 (mid-December to late January). Matchday 22 is <strong>deadline day</strong>, and simming to matchday 21 lands you on it with the window still open.</li>
          </ul>
          <p>
            <strong>Market value.</strong> A player's value climbs steeply with OVR (an average
            starter runs $35&ndash;45M, an elite player can top $150M), then gets multiplied by age
            (youth is a premium here, since you're buying years of control and resale value, so value
            peaks in the late teens and drops hard after 28), by potential headroom (a big gap
            between potential and current OVR is worth a real premium for young players, fading to
            nothing by 30), and by remaining contract length (a player locked up for years is
            pricier to pry loose).
          </p>
          <p>
            <strong>Values are capped, and the very best players aren't for sale.</strong> No
            player's value ever runs past $350M, so you'll never see a fantasy price tag. Instead,
            the genuine elite are simply taken off the market the way a top club would never sell
            its star at any price: if a player was one of the best in the world last season &mdash;
            either a top-of-the-league OVR, or he won Player of the Season, the Golden Boot, or a
            Team of the Season place &mdash; and his club finished in the top four of a top-flight
            league, he's not for sale to anyone. He won't appear in your recommended targets and any
            offer you make is ignored. You can still buy a solid, competitive squad, but the
            difference-makers who actually win titles you have to develop yourself (a gamble, per the
            note on potential above) or catch at a club that had a down year. Money buys you a good
            team; it can't buy you a great one.
          </p>
          <p>
            <strong>Buying.</strong> The Transfers page recommends 5&ndash;10 for-sale players near
            your level and within your budget, and how accurately they're ranked comes down to your
            scouting spend (<a href="#finance">Finance</a>). The filters (position, min OVR, min
            potential, max age, max value) actually re-run the search rather than just hiding rows,
            so pinning a position pulls up a fresh, fuller list of players there. Negotiation goes
            like this: the selling club has a hidden asking price, rolled once per window, so you
            can't reopen talks hoping they're in a better mood. Offer way below it and they hang up
            for the rest of the window. Offer low-but-believable and they counter above their true
            price, giving up a little less each round. Repeat an offer they already rejected, or drag
            it past five rounds, and talks are over. Meet the price and the deal goes through on the
            spot: fee out of your budget, player on your roster.
          </p>
          <p>
            <strong>Search all players.</strong> Under the recommended list is a search panel that
            reaches every club in the world, not just targets near your level. Type a name, or set
            any of the same filters (position, min OVR, min potential, max age, max value), and it
            lists matching players from every league with an Offer control right on the row &mdash;
            negotiation works exactly as above. Two things it won't let you buy: a player his club
            needs for squad depth, and the very best players at clubs coming off a big season, who
            aren't for sale at any price. In those cases the row says why instead of taking an offer
            that would go nowhere.
          </p>
          <p>
            <strong>The player has to want it.</strong> Money isn't the whole story, and this is the
            big way football differs from basketball: there's no salary cap here, so nothing would
            otherwise stop a superstar dropping into a small club that happened to have cash. So
            players have a say. The better a player is, the more he cares about the size of the club
            he's joining, judged on squad quality and fame together. A fringe squad player will go
            wherever the game time is. A genuine star will move sideways or up, but won't drop to a
            much smaller club at any price, and a row that says "Wouldn't drop to a club this size"
            means exactly that. This applies to you the same as to every AI club, so building your
            own reputation is what opens up the top of the market.
          </p>
          <p>
            <strong>Settling in.</strong> A player who's only just joined somewhere is much harder to
            prise away again, and gets easier over about three seasons. Squads hold their shape from
            year to year instead of reshuffling every summer.
          </p>
          <p>
            <strong>Selling.</strong> During a window, AI clubs that rate your players will come in
            with offers, up to 4 at a time, from whichever club values each player most (
            <a href="#ai">how they decide</a>). You can accept (immediate sale, fee into your
            budget), reject, or counter upward. The buyer haggles by exactly the same rules you face
            when buying, just mirrored, and walks away from greedy counters the same way a seller
            would. Sold players show up in a "Sold This Window" section so deals never vanish on you.
            Each offer comes with a one-line scout take: a straight "take it," a suggested counter
            price, or a dismissive "not worth discussing," based on how the offer stacks up against
            the player's open-market value. Like Recommended Transfers, how sharp that read is
            depends on your scouting spend (<a href="#finance">Finance</a>) &mdash; a thin scouting
            budget gives you a fuzzier, less reliable take.
          </p>
          <p>
            <strong>List for transfer.</strong> AI clubs already scout your whole roster on their
            own, but the <strong>List</strong> menu on the Roster page (in each player's pitch
            popover and in his XI or bench row) lets you flag a player as available, a clearer
            signal that you're open to selling. The same menu is where you list him for loan. A listed player needs a much smaller edge in value to some AI club to
            draw a bid, and gets first claim on one of the 4 offer slots each window over an unlisted
            player. It's not a guarantee (a buyer still has to rate him above what he's worth to
            you), just better odds of a bite.
          </p>
          <p>
            Every completed transfer in the league, yours and the AI's, lands in the News Feed.
          </p>
        </Section>

        <Section id="loans" title="Loans">
          <p>
            A loan sends one of your players to another club's roster for a fixed <strong>1, 2, or
            3 seasons</strong> without selling him. He plays for (and develops at) his loanee club
            the whole time, then comes back to you on his own once the loan ends. It's the move for a
            good player stuck behind a better one on your depth chart: real minutes matter for
            development, so a season out on loan can be worth more to him than a season on your
            bench.
          </p>
          <p>
            From the Loans page, <strong>list</strong> a senior-roster player and pick a duration
            (the depth floor still applies, so you can't loan away your last cover at a position).
            You can also list him from the Roster page: the <strong>List</strong> menu on each
            player (pitch popover, XI row or bench row) holds both listings, so
            "List for loan (1 season)" is one click from the squad screen &mdash; use the Loans page
            if you want a 2 or 3 season loan instead. It's the same listing either way, so it shows
            up on both pages, and the loan half of the menu is only available while a transfer
            window is open. A player listed for loan carries an <strong>L</strong> flag on his pitch
            chip, the same way a transfer-listed player carries a <strong>$</strong>.
            Interested AI clubs then make offers there, each with a flat, non-negotiable fee and the
            duration you picked. Accept one and the move goes through right away, or reject and keep
            looking. The <strong>loanee club pays the fee up front and covers his wages for the whole
            loan</strong>. His contract itself doesn't change, and once he's back he's still on the
            same deal he left with. AI clubs also loan players to each other in the background, and
            they stick strictly to real-football logic: <strong>only young players who aren't in
            their club's starting XI</strong> go out on loan. A starter is already getting his
            minutes at home, so he's never loaned, whatever the numbers say. A club will let a
            prospect it rates highly go out, though, as long as someone else rates him more, so the
            players moving are genuinely ones worth watching rather than only the ones nobody wanted.
            Second-division clubs can't take a loan of a player good enough that the top flight would
            claim him anyway. That background market only ever moves players between AI clubs, so
            nothing happens to your own roster unless you list a player yourself.
          </p>
          <p>
            <strong>A loan can't run past his contract.</strong> Since his deal doesn't change while
            he's away, a loan that outlasted it would mean he was somewhere else when it ran down
            and left on a free the moment he got home &mdash; so the duration list only offers the
            seasons his current contract covers. A player in the last year of his deal can go out
            for one season, not three. Extend him first if you want to send him further out.
          </p>
          <p>
            He's still your player the whole time he's away, contract included. The
            <strong> Players Out on Loan</strong> list at the bottom of the Loans page shows when
            each deal expires and lets you extend him from there, one at a time or all at once,
            which is the only place you can &mdash; he isn't on your Roster page while he's gone,
            so the Roster page's own Extend all button can't reach him.
          </p>
        </Section>

        <Section id="contracts" title="Contracts, Wages & Free Agents">
          <p>
            Contracts are one-button. The game shows you the exact weekly wage and length, and you
            take it or leave it, no salary haggling. Length comes off age: <strong>3 years</strong>{" "}
            under 30, <strong>2 years</strong> at 30&ndash;32, <strong>1 year</strong> at 33+.
            Academy players are the exception, and <a href="#youth">The Youth Academy</a> covers
            their flat stipend, which doesn't follow this age/ovr scale.
          </p>
          <p>
            Wages climb steeply with ability, so superstar money is real money. Roughly, per week
            (each signing rolls ±15%):
          </p>
          <table className="table table-sm table-striped" style={{ maxWidth: "24rem" }}>
            <thead><tr><th>OVR</th><th>Weekly wage</th></tr></thead>
            <tbody>
              <tr><td className="stat-num">60</td><td className="stat-num">~$11k</td></tr>
              <tr><td className="stat-num">65</td><td className="stat-num">~$21k</td></tr>
              <tr><td className="stat-num">70</td><td className="stat-num">~$36k</td></tr>
              <tr><td className="stat-num">75</td><td className="stat-num">~$57k</td></tr>
              <tr><td className="stat-num">80</td><td className="stat-num">~$84k</td></tr>
              <tr><td className="stat-num">85</td><td className="stat-num">~$120k</td></tr>
              <tr><td className="stat-num">90</td><td className="stat-num">~$164k</td></tr>
            </tbody>
          </table>
          <p>
            A player whose contract expires becomes a <strong>free agent</strong>, signable for no
            transfer fee, just wages, on the same one-button terms. Extend your own players from the
            Roster page before they walk (pick any length from 1 to 4 seasons, and length doesn't
            change the wage). The AI extends its own keepers too (<a href="#ai">details</a>), so the
            free-agent pool is mostly players somebody decided not to hang onto.
          </p>
          <p>
            Nobody manages your squad for you, so an expiring deal you don't act on just runs out and
            the player leaves on a free the next offseason. To keep that from sneaking up on you, the
            Roster page flags anyone in the final year of his deal with a <strong>"Final year"</strong>{" "}
            badge and a heads-up banner, so you can extend him before he's gone for nothing. Academy
            stipends run out the same way, so the Academy page carries the same badge and banner for
            your prospects.
          </p>
          <p>
            That banner also carries an <strong>Extend all</strong> button, which re-signs every one
            of those players at once so you don't have to work down the list. It quotes the total
            weekly wage before you press it, and each player gets the default length for his age
            rather than a length you pick, so extend anyone you want on different terms yourself
            first. Anyone holding out for a move to Division 1 is left out and the banner says so.
            The Academy page and the Players Out on Loan list on the Loans page each have their own
            button, covering the players on that page.
          </p>
          <p>
            Signing a free agent shows up on his profile as a <strong>free move</strong> the same way
            a paid transfer does &mdash; in his transfer history, on his transfer-value chart, and in
            the News Feed for your own signings. Signing a prospect straight into your academy counts
            as one too, so the club on his profile matches where he actually is.
            Before, a free signing left no trace, so his profile could wrongly show him still at a
            club he'd long since left even while he was playing for you.
          </p>
          <p>
            Don't count on picking up a gem for free, though. Each offseason the AI clubs work the
            free-agent pool before you do, and they don't just fill holes: any club will grab a
            genuinely useful free agent to upgrade a spot it's already stocked at. By the time you
            get to the Free Agents page, most of the good ones are gone and what's left skews toward
            squad filler and reclamation projects. A real bargain still turns up now and then, but
            it's the exception.
          </p>
          <p>
            The pool also doesn't just pile up anymore. A player who goes a full season with nobody
            signing him starts rolling to <a href="#development">retire</a>, at any age, so the
            journeymen clear out over time instead of sitting on that page forever. Young prospects
            with a high ceiling are exempt and will wait for a club however long it takes, so this
            thins out the filler rather than the talent.
          </p>
          <p>
            <strong>Signed a free agent? You're keeping him for a season.</strong> A free agent you
            sign onto your senior roster can't be sold until the following season &mdash; no AI club
            will bid on him, and the Roster page shows "Can't sell yet (just signed)" in place of the
            List for Transfer button until the hold clears. This closes the old loophole of signing a
            free agent for nothing and immediately flipping him for a fee. You can still release him
            for free at any time; you just can't cash him in right away.
          </p>
          <p>
            If you run a Division 2 club, every so often a breakout player will refuse a new deal.
            The Roster page shows "Wants a move to Division 1" instead of an Extend button once he's
            genuinely good enough that a Division 1 club would want him. He can't be extended or
            stopped from leaving, and the best you can do is sell him yourself before his contract
            runs out, since letting him walk for free gets you nothing. It works the other way too:{" "}
            <strong>Division 2 clubs never buy players of that caliber</strong>, not from each other
            and not from you. A player good enough for the top flight just wouldn't sign for the
            second division, so don't expect a Division 2 club in the bidding for your stars.
          </p>
        </Section>

        <Section id="finance" title="Finance">
          <p>
            Every club starts each season with the same base allocation (<strong>$88M</strong>),
            and the squad's <strong>entire season wage bill is paid up front</strong> at the season
            start. Whatever's left is genuinely yours to spend, on transfer fees, mid-season
            signings, and scouting. A mid-season pickup (transfer buy or free-agent signing) charges
            the player's full season salary the moment you get him, on top of any fee.
          </p>
          <p>At season's end, the settlement adds and subtracts the rest:</p>
          <ul>
            <li><strong>Prize money</strong>. $40M for winning the league, $20M for finishing 2nd&ndash;5th, $10M for 6th&ndash;10th, nothing below that.</li>
            <li><strong>Hype revenue</strong>. Every club has a hype score (0&ndash;100) that drifts toward its recent results rather than snapping to them. Hype earns extra revenue (up to ~$30M at max hype), deliberately kept modest so fame stays a bonus and not an engine. Success payouts matter more.</li>
            <li><strong>Scouting spend</strong>. Whatever you set the slider to comes out here.</li>
          </ul>
          <p>
            <strong>Scouting</strong> is one slider, $0&ndash;20M per season, starting at $5M. You
            set it <em>once a year, in the offseason</em>, and it's locked for the whole season it
            covers (deducted at that season's end), and during the season the slider is disabled.
            You can't skip the decision either: when you advance to a new season the game stops you
            on a Set Scouting Budget screen first, so every year you actively choose the number
            before the games start.
            That's on purpose: you commit to the spend, and pay for it, before you get the sharper
            view, so you can't crank it up to peek at a player and turn it straight back down. It
            buys accuracy, not players. Every value you see on a transfer target (Recommended
            Transfers, negotiation offers, incoming offers for your own players) is a{" "}
            <em>perceived</em> value, not the real one, and how far off it can be comes down to your
            spend. At $0 it's noisy (±35%, so a target that looks like a bargain, or a rip-off, might
            just be a bad read), and at the $20M max it's nearly exact (±5%). Spend also drives the{" "}
            <a href="#players">potential (POT) fog</a>: more scouting tightens every player's
            estimated-potential band and reveals a signing's true ceiling sooner. So plan ahead. If
            you expect a busy transfer year, set your scouting budget high in the offseason before
            it.
          </p>
          <p>
            The Finance page shows all of it: current budget, hype, the wage-bill table, a
            settlement projection (final numbers once the season ends), your full transfer history,
            and a league-wide money table for comparison. A competition dropdown (grouped by country)
            scopes that table, defaulting to whichever competition your own club is currently in,
            with an "All Competitions" option to see every club in the world at once. AI clubs are
            tuned to never go broke. <em>You</em> can overspend, though: hoard a full roster of elite
            wages and the projection will happily show you the shortfall coming. Budget is a running
            balance that carries over between seasons instead of resetting. The savings cap scales
            with a club's fame: a top-flight club can bank up to <strong>$400M</strong> at full hype,
            down to <strong>$200M</strong> for a club with no fame (Division 2 clubs are capped lower
            on top of that, reflecting the money gap between divisions). Spending below your cap is
            unrestricted, but you can't bank cash past it.
          </p>
        </Section>

        <Section id="youth" title="The Youth Academy">
          <p>
            Every offseason, your club's academy turns out <strong>3&ndash;5 new 16-year-olds</strong>,
            landing in a holding pool on the Academy page instead of straight onto your senior
            roster. They show up raw, well below first-team level, but with youth on their side, and
            some will develop into stars (and some won't, see <a href="#players">potential</a>).
          </p>
          <p>
            Academy quality starts from a fixed trait each club has, set when the league is created,
            so a big club's intake trends better than a small club's. That slope has a floor under
            it: the weakest clubs in the world turn out genuinely poor prospects, but never ones so
            bad they aren't footballers. On top of that anchor,{" "}
            <strong>recent results move the needle</strong>: young players want to join a club that's
            been winning, so finishing high in your league over the last few seasons nudges your
            intake quality up, and finishing low nudges it down. It's a gentle pull, not a
            transformation. Sustained success at the top of the table is worth a few points of intake
            quality over sustained struggle, judged over roughly the last three seasons, and it fades
            as results normalize. Buying a great squad doesn't do it. The results themselves are what
            count.
          </p>
          <p>
            Academy players draw a cheap flat weekly stipend instead of the normal wage formula, and
            they can't be transferred. Each has a one-button <strong>Extend</strong> (fresh stipend
            terms once his contract hits its final season) or <strong>Release</strong> (cut him
            outright, since the academy has no depth floor to protect, unlike your senior roster);
            <strong> Extend all</strong> in the banner does the whole final-year group at once.
            When one's ready, <strong>Promote</strong> moves him onto your senior roster on a normal
            ovr-based wage, which is blocked once you're at the 30-man roster cap. The academy has
            its own cap, separate from your senior roster's, at 10 prospects.
          </p>
          <p>
            AI clubs don't keep a real academy pool. Their youth intake still lands straight on their
            senior roster and gets trimmed back to target depth like any other offseason surplus. If
            you leave your own academy alone for several seasons while your senior roster shrinks
            (retirements, expiring contracts you don't re-sign), the game will automatically call up
            your best academy prospects, goalkeeper first if you have none at all, to keep your squad
            fieldable. This is a last-resort safety net, not a real way to build a squad, so check in
            on the Academy page regularly instead.
          </p>
          <p>
            Prospects age 21 or younger who were never on any club's academy or roster show up on the{" "}
            <strong>Incoming Talent</strong> page instead, where you can sign them straight to your
            senior team or into your academy. Older free agents live on the separate{" "}
            <strong>Free Agents</strong> page.
          </p>
        </Section>

        <Section id="ai" title="How AI Clubs Think">
          <p>
            AI clubs don't run off scripts like "big club buys stars, small club sells." Instead,
            each club keeps working out its outlook from its actual situation:
          </p>
          <ul>
            <li><strong>Ambition</strong>. Win-now pressure, blended from wealth, fame, squad strength, and recent form. An ambitious club pays up for prime-age quality, a low-ambition club builds young.</li>
            <li><strong>Frugality</strong>. Financial caution, driven by relative wealth. Rich clubs can eat an expensive mistake, poor clubs can't, and they price accordingly.</li>
          </ul>
          <p>
            When an AI club sizes up a player, it starts from his open-market value and adjusts for
            its own needs: <strong>positional need</strong> (thin at his position and he'd be an
            upgrade? worth more; already loaded there? worth less), <strong>timeline fit</strong>{" "}
            (does his age match the club's ambition?), and <strong>affordability</strong> (a deal
            that eats too much of the budget gets marked down, harder for frugal clubs). Two clubs
            looking at the same player genuinely value him differently.
          </p>
          <p>
            Pricing its <em>own</em> players is a different question, and the club asks it
            differently: not "how much would he improve us" (he's already here) but "how far would we
            fall back without him". A star with no ready deputy behind him is priced brutally
            &mdash; that's the whole gap between his level and his replacement's &mdash; while one
            with a good understudy is easier to prise loose. A club also won't write off its own
            young talent just because it's chasing the title this season.
          </p>
          <p>
            <strong>The AI-to-AI market</strong> runs once per window on a single rule: a player's
            asking price is what he's worth <em>to his own club</em>, and he moves to whichever club
            values him meaningfully more than that and can afford the fee (which splits the
            difference between the two valuations). Everything you'd expect falls out of that one
            rule with no special cases. Surplus players get dumped, aging stars get sold at peak the
            moment their keep-value dips below their market price, and needy clubs overpay for scarce
            positions. And a club that's sitting on cash with a real hole in its squad (short of
            bodies at a position, or a clear weak spot in its best XI) won't hold out for a bargain
            the way it does for a luxury buy. It'll pay a fair price to fill that hole and dig a bit
            deeper into its budget to get it done, so rivals patch their gaps instead of hoarding
            money. Guardrails keep it sane: clubs won't auction off irreplaceable core players,
            cap themselves at 3 buys and 3 sells per window, always respect the depth floor and
            roster cap, and hold back a cash reserve instead of spending to zero (so even a
            gap-filling club never bankrupts itself, and the genuine superstars stay unbuyable at any
            price). On top of all that, players won't drop to much smaller clubs and won't be
            shifted easily in their first seasons somewhere (see{" "}
            <a href="#transfers">Transfers</a>), so the very best players change club rarely &mdash;
            roughly one in ten in a season &mdash; and when they do it's sideways or upward, for a
            fee that makes the news. You can watch every deal in the News Feed.
          </p>
          <p>
            <strong>Contract renewals.</strong> Before contracts expire each offseason, every AI club
            re-signs any expiring player it still values above his new wage, on the same one-button
            terms you get. Players who don't clear that bar (too old, too expensive, squad surplus)
            get let go into free agency. So an AI club's good young players rarely walk for free, but
            a declining veteran on superstar wages will.
          </p>
          <p>
            AI valuations also carry a little noise, since clubs aren't all-knowing, so the "best"
            bidder doesn't always land a player.
          </p>
        </Section>

        <Section id="strategy" title="Strategy">
          <p>Think like a real sporting director:</p>
          <ul>
            <li><strong>Age is an asset class.</strong> A 21-year-old and a 29-year-old at the same OVR are totally different buys. The young one holds his resale value (and might still grow), while the veteran loses value every season. Buy young, sell before the decline.</li>
            <li><strong>Watch the wage bill, not just fees.</strong> Wages climb steeply with OVR and come out of your budget up front. A squad of 80s can out-wage your income even if you never pay a single transfer fee, and the Finance page shows you exactly where you'll land.</li>
            <li><strong>Sell into demand.</strong> Incoming offers come from clubs that actually need your player, and their first bid is rarely their best. Counter once or twice before you accept, but greedy counters end talks.</li>
            <li><strong>Decide your scouting spend a year ahead.</strong> It sharpens valuations, target rankings, and potential estimates, but you set it in the offseason and it's locked for the season. So if you're planning a busy transfer year, budget for scouting the offseason before, and dial it back for a quiet one.</li>
            <li><strong>Potential is a forecast, not a fact.</strong> Most players fall short of it. Paying a big potential premium is a real gamble, and that's the game working as intended.</li>
            <li><strong>Deadline day is leverage.</strong> Asking prices are fixed for the whole window, so there's no discount for waiting, but simming to matchday 21 guarantees a last look at the market (and any incoming offers) before it shuts.</li>
          </ul>
        </Section>

        <Section id="frivolities" title="Frivolities">
          <p>
            Frivolities holds the all-time lists derived from records your save already keeps.
            None of it affects play. It has seven tabs.
          </p>
          <p>
            <strong>GOAT</strong> ranks the greatest players and clubs in your save from a fixed
            formula. A player is scored on six things: his peak rating, his prime (the years spent
            near that peak), career length and sustained match rating, individual awards, trophies,
            and goals and assists. Prime is weighted to outweigh peak over a long career, and
            individual awards make up roughly half of a typical score. Clubs are scored mostly on
            trophies, with top-four finishes and points per game separating clubs with similar
            trophy counts. A treble is worth a large bonus on top of the three trophies it's made
            of, so winning all three in one season counts for much more than winning them in
            different years. Selecting a row expands it into the full calculation: every award,
            trophy and stat that contributed, how many of each, and what one is worth. Retired
            players are ranked alongside active ones. Known limitation: the player ranking favours
            attackers, because it builds on the Ballon d'Or and Player of the Season scores, which
            are based on scoring and contain no defensive stats. The Team of the Season and World
            Team of the Year terms partly offset this, since those awards fill specific positions,
            but they do not correct it fully. The formula is a first draft.
          </p>
          <p>
            <strong>Awards</strong> collects every individual honour the game has handed out. The
            career board counts Ballon d'Ors, World Team of the Year places, Players of the Season,
            Golden Boots and Team of the Season places, and you can rank it by any one of them or
            by the lot. Below it, single seasons are ranked by the Ballon d'Or score they earned,
            which answers which individual season your save has ever seen was the best one;
            selecting a row breaks that score into what he did in his league, in the Continental
            Cup, with his country, and whether he won his title. The Ballon d'Or record board goes
            deeper than wins: the whole top ten is kept every season, so second and third places
            count, and shares score each finish (a win is 1.00, tenth place 0.10) so a career of
            near-misses can outrank a single win. There's also a roll of honour, the youngest and
            oldest winners, and the same awards totalled by club and by country. A club is credited
            for the season the player was there, not for where he ended up. Team trophies aren't
            counted here; they're on GOAT and on Club Records.
          </p>
          <p>
            The tab also builds any club's <strong>all-time award XI</strong>, laid out on a pitch,
            starting with your own. Both the Team of the Season and the World Team of the Year are
            picked position by position, so this is a record rather than a ranking: each slot goes
            to whoever that club has had picked there most often, counting a worldwide place above
            a domestic one. A player can only hold one slot, so someone picked at two positions over
            his career takes his stronger one and the next best man gets the other. A position
            nobody has ever been picked in is left empty rather than filled with the nearest
            approximation.
          </p>
          <p>
            <strong>Records</strong> covers the most dominant and worst team seasons, the highest
            rating any player has reached, the longest careers, and the biggest transfer fees. Team
            seasons rank by points per game rather than raw points, so a season in a smaller league
            isn't penalised for playing fewer matches. The transfer list counts permanent deals
            only, since loans and free moves aren't purchases. Plain stat leaderboards live on
            All-Time Leaders instead, so the two tabs don't repeat each other.
          </p>
          <p>
            <strong>All-Time Leaders</strong> opens on every stat at once, as a grid of cards
            showing the top 10 in each. Click a category and you get its full top 30, with clubs,
            appearances and the season each figure comes from. One switch sits above the grid and
            applies to every card: career totals, or the best single seasons recorded. Anyone who
            has played a league game for your club is highlighted, on the cards and on the full
            boards, so you can see at a glance which records your own players hold. It counts
            former players too, which is the point: an all-time list is mostly people who have
            moved on or retired. Two
            differences from Stat Leaders, which covers one season at a time: these boards cover
            the whole world at once rather than one league, because a career crosses divisions and
            countries; and the single-season view shows one row per player, his best, rather than
            one row per season.
          </p>
          <p>
            <strong>International</strong> is the all-time national-team record book: most
            international goals, most caps, and most World Cups won. It lays out the same way
            All-Time Leaders does, a card per category showing the top 10, and clicking one opens
            its full top 30 with caps, goals and World Cups side by side. A player's caps and goals
            cover his whole international career, qualifying and World Cups together, the same
            numbers his profile shows. The country dropdown sits above the cards and filters all
            three at once, which is what the tab is really for, since it answers who your country's
            all-time leading scorer is. Your own players are highlighted here too. Retired players
            matter more here than anywhere else on the page: an all-time top scorer has almost
            always finished playing by the time he holds the record, so a list of active players
            only would hand it to someone new every few seasons.
          </p>
          <p>
            <strong>Player Bios</strong> covers the current player pool: oldest and youngest, which
            countries the world's players come from and each country's best player, one-club men,
            and the longest and most common names. Academy players are included, which is why the
            youngest list is entirely teenagers.
          </p>
          <p>
            <strong>Club Records</strong> is the club-level version: the trophy cabinet (total
            trophies, then league titles, Continental Cups, domestic cups, trebles and
            second-tier titles), the longest wait for a title, all-time biggest spenders, and
            the clubs that have made the most money trading players. A treble is counted where
            the three wins fall in one season, and it isn't added to the total, since those
            three trophies are already in it.
          </p>
          <p>
            Retired players are otherwise deleted from the save entirely, so the game keeps a
            permanent record of the ones who either reached a high rating or played a long career.
            That is what lets the all-time lists cover them. The rest are still deleted, which
            keeps the save file from growing without limit. On an older save the record starts
            from your next offseason, because players who retired earlier left nothing to recover.
          </p>
          <p>
            Anyone with that record kept is still clickable. His name links to a career page, the
            same way a current player's does, from the all-time lists and from anywhere else he
            comes up: an old transfer, a news item, your own transfer history, an awards board. The
            page carries the season he retired and the age he did it at, his peak rating and when
            he hit it, the clubs he played for, career totals with his best single season in each
            stat beside them, his trophies and awards, his caps and international goals, and a
            season-by-season line with the club and rating for each year. It shows less than a
            current player's profile because that's all that was kept: no attribute ratings, and no
            per-season goals and assists behind the career totals. An appearance count of zero in
            the seasons list means he was in the squad that year but never got on the pitch. A
            retiree the game didn't keep is still just a name.
          </p>
        </Section>

        <Section id="godmode" title="God Mode">
          <p>
            God Mode is an optional sandbox. It's a per-save switch in the top bar. Turn it on any
            time, turn it off any time, and nothing gets penalized or locked. While it's on, the
            usual rules that keep the world realistic just don't apply to you. Your edits ignore
            transfer fees, budgets, the 30-man roster cap, and the depth floor that normally stops
            you gutting a squad. It's for building a dream league, testing an idea, or fixing
            something the sim did that you'd rather it hadn't. Not for a straight, honest career.
          </p>
          <p>What it unlocks while it's on:</p>
          <ul>
            <li><strong>Edit any player.</strong> Open any player's profile and hit <em>Edit</em>. Change every one of his 14 ratings (OVR recomputes as you go), his potential, name, nationality, age, position, height, and his contract wage and length. You can also clear an injury outright.</li>
            <li><strong>Move players freely.</strong> From a player's profile, send him to any club instantly, with no fee, no budget check, and no cap, or release him to free agency.</li>
            <li><strong>Create players.</strong> The <em>God Mode</em> page (it shows up in the sidebar once the switch is on) has a Create Player tool. Build a player from scratch and drop him onto any club or leave him a free agent.</li>
            <li><strong>Build any club's roster.</strong> The same page lets you pick any club and add, move, or release its players directly.</li>
            <li><strong>Set club finances and identity.</strong> Set any club's budget and hype to whatever you want, and rename or recolor any club.</li>
            <li><strong>See true potential.</strong> The scouting fog lifts while God Mode is on, so every player's exact potential shows everywhere, not an estimate.</li>
          </ul>
          <p>
            What it deliberately <em>won't</em> do: it can't add or delete whole clubs (the world is
            a fixed 20-per-league shape the schedule depends on), it can't erase a player from
            history (releasing him to free agency is how you get rid of him), and it can't force a
            match result or rewrite the standings. Everything else about the sim keeps running
            normally around your edits.
          </p>
        </Section>

        <Section id="faq" title="FAQ & Known Quirks">
          <p><strong>How do I win?</strong> You don't, the game never ends. Set your own goal: a title, a decade of dominance, an all-academy XI.</p>
          <p><strong>Where can I see that a player is injured?</strong> Injured players show a red cross on your Roster (on the pitch chip and next to their name in the tables) and on their profile, and your Dashboard has an Injuries list of everyone currently out and roughly how long. They sit out on their own until they're fit.</p>
          <p><strong>Can I change formation?</strong> Yep. Pick from sixteen shapes (4-3-3, 4-4-2, 3-5-2, 5-3-2, 4-2-3-1, 4-5-1, 3-4-3, 5-4-1, 4-3-1-2, 4-4-1-1, 4-3-2-1, 4-2-2-2, 3-4-2-1, 3-5-1-1, 5-2-3, 5-2-1-2) in the dropdown above the pitch on the Roster page. It changes which eleven you field (and so your match strength), and resets your Starting XI to the best fit for the new shape. Or just click <strong>Best XI</strong> next to the dropdown to let the game pick the shape that fields your strongest eleven and fill the lineup for you. Each AI club automatically uses whichever shape fields its own strongest eleven, refreshed at the end of each transfer window (summer and winter).</p>
          <p><strong>Can I go into debt?</strong> AI clubs are tuned never to. You can, by hoarding elite wages past what the base allocation covers. The Finance page shows you the shortfall before it hits. There are no debt consequences yet beyond the number itself.</p>
          <p><strong>I bought a striker in January and his whole season's stats show at my club.</strong> Season stats are one running total per player and show at his current club. There's no per-club split for mid-season movers yet. (Known quirk.)</p>
          <p><strong>A recommended target or incoming offer disappeared.</strong> Both lists are recalculated live from the state of the league, so a target can get bought by an AI club right out from under you, and an offer can drift if the bidding club's situation changes. Deals you've already agreed to are never affected.</p>
          <p><strong>Why can't I release this player?</strong> The depth floor. Releasing him would leave a position without enough cover to field a legal team. Sign or promote cover first.</p>
          <p><strong>Why did his potential drop? Scouts promised 82!</strong> Potential is a forecast that gets re-estimated over time (see <a href="#players">Players</a>). A development setback lowers the realistic ceiling, and the estimate follows it down.</p>
          <p><strong>Why is potential shown as a range like "74&ndash;88"?</strong> You never see a player's exact potential, just a scouting estimate that brackets the real value (see <a href="#players">Players</a>). Raise your <a href="#finance">scouting spend</a> to tighten it, and keep a player on your senior roster for a couple of seasons to reveal his true ceiling. The midpoint isn't the answer, the truth can sit anywhere inside the band.</p>
          <p><strong>Do AI clubs cheat?</strong> Nope. They play by the exact same rules you do: same wages, same budgets, same roster limits, same transfer machinery, no hidden income. The whole league's finances are on the Finance page if you want to check.</p>
          <p><strong>How does a player earn a "League Champion" trophy?</strong> He has to have been in the squad that won it. The credit comes from his own season record at the club, so signing for a club with a trophy cabinet doesn't hand him anything he wasn't there for. The one rough edge is mid-season movers: a title counts for whoever's squad he finished the season in, so a January arrival at the champions gets it and a January departure doesn't.</p>
          <p><strong>Why does the transfers page only show some of the completed deals?</strong> Because drawing all of them is what used to freeze the page. A full world moves thousands of players in a summer window, and rendering every one (each with a flag) was over 10,000 elements and about a megabyte of flag art. You now get all of your own club's business plus the 50 biggest deals elsewhere; the News Feed has the complete record.</p>
          <p><strong>My player's cup stats suddenly went up a lot.</strong> They were wrong before, and now they're right. The Continental Cup has three stages, and cup stats used to count only the knockout ties, so league-phase and playoff games never showed up on anyone's profile at all. They all count now, including for past seasons, so appearances and goals jump for anyone who played group games. Nothing was inflated, it was under-counted.</p>
          <p><strong>Where did all the free agents go?</strong> Once a free agent turns 24, has never been any good in his career, and isn't projected to become good, he's permanently removed from the game. Nothing ever cleared these players out before, so a long save built up thousands of them, which bloated saves badly. Anyone under 24 is kept, so your incoming talent list is unaffected, as is anyone with real potential left and any former star who's since declined.</p>
          <p><strong>Why does the game get slower the longer I play?</strong> It used to be because the entire save was rewritten every time anything happened, so the more history you'd built up, the more every single click cost. Players are now stored individually and only the ones that actually changed get written, so signing someone or setting your lineup no longer depends on how long you've been playing. What's left is the running history a save keeps (power rankings, transfers, news, past seasons), which is still rewritten in full, so there's still some growth. Simming is a separate cost and is unchanged.</p>
          <p><strong>A page showed me an error box instead of the page.</strong> Something in the game broke while drawing that page. Your save isn't affected and nothing was written to it, so you can use the menu to go somewhere else, or hit Try again to have another go at the page. The error details are there to copy into a bug report, and the crash is reported automatically too. There's a known one on the Transfers page that hasn't been pinned down yet, so if you hit it there, the details are genuinely useful.</p>
        </Section>
      </div>
    </div>
  );
}
