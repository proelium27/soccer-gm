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
  ["pages", "The Pages"],
  ["season", "The Season & Simming"],
  ["world", "The World"],
  ["cup", "The Continental Cup"],
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
      <h4>Manual</h4>
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
            If you'd rather bring in real teams in bulk, the Leagues screen has "Export Teams" and
            "Import Teams" on each save. Export hands you a plain text (JSON) file listing every club,
            grouped by league; edit it however you like (or ask an AI to fill in a real league) and
            load it back with "Import Teams". The file matches clubs to your existing leagues by slot,
            so it's the easiest way to turn the fictional default world into real ones, and you can
            list only the leagues you care about and leave the rest alone.
          </p>
          <p>
            A club entry can also carry a <em>players</em> list to bring in a real squad, not just a
            name. Each player needs a name, position, and age, plus either an <em>overall</em> (the
            game builds position-appropriate ratings to match it) or an exact <em>ratings</em> block
            if you want full control; nationality, height, and potential are optional. You don't have
            to list a full 25 — whatever you leave short gets topped up with lower-rated reserves so
            the squad is always legal to field. Importing a squad replaces that club's existing
            players, so it's best done on a fresh save. Leave the players list off a club and only its
            name and colors change, exactly like Customize Teams.
          </p>
          <p>
            Writing all that JSON by hand is tedious, so the easiest route is to let an AI build it.
            The "Copy AI Prompt to Customize" button in the top bar (once you're in a save) copies a ready-made
            prompt to your clipboard, already filled in with your world's exact league names and sizes.
            Paste it into ChatGPT or Claude, tell it which leagues you want and how real to make them,
            save its reply as a <code>.json</code> file, and load it with Import Teams back on the
            Leagues screen. (If your browser blocks clipboard access, the button downloads the prompt as
            a text file instead.)
          </p>
          <p>
            England's and Spain's clubs all have real crest art that shows up wherever the club's
            name does. Every club without one yet (Italy, Germany, France and Portugal) just shows a
            two-color swatch until it gets a crest of its own.
          </p>
        </Section>

        <Section id="pages" title="The Pages">
          <p>Every screen in the game and what it's for:</p>
          <ul>
            <li><strong>Dashboard</strong>. Your current W/D/L record and next fixture front and center, with your division's standings on the left and the latest news headlines on the right. Below that, a Stat Leaders section splits league-wide leaders from your own squad's leaders across a few key stats, and below that a finances snapshot with the scouting-spend slider and the sim buttons.</li>
            <li><strong>Standings</strong>. The league table, plus each club's current OVR/POT. A season dropdown lets you pull up any past season's final table next to the current one. The champion's row is highlighted, and the <a href="#cup">Continental Cup</a> qualification places are shaded.</li>
            <li><strong>Continental Cup</strong>. The live league-phase table and knockout bracket for the current season, plus past winners via a season dropdown. More in <a href="#cup">The Continental Cup</a>.</li>
            <li><strong>Power Rankings</strong>. Every club in the world ranked by a blended Power score: squad OVR (Starting XI plus bench, depth-weighted, same formula as Standings' OVR column) plus a current-season form bonus or penalty. Form isn't just your record. Beating a strong side counts for more than beating a weak one (and losing to a weak side hurts more than losing to a strong one), and goal difference factors in too, so a club can rank above or below its raw OVR depending on how it's actually playing. Record, goal difference, OVR, and the blended Power score all sit side by side, with a badge showing each club's competition and its rank within it. Click a team to expand its full roster in place. The rankings also get snapshotted every 5 matchdays (plus once after the final matchday), and a dropdown lets you browse any past snapshot from any season, with arrows showing how far each club rose or fell since the last one. Historical views can't expand rosters, since past squads aren't stored, and snapshots only start piling up from the point this feature shipped.</li>
            <li><strong>Schedule</strong>. Every matchday's fixtures and results. Click a played match for its box score.</li>
            <li><strong>Stat Leaders</strong>. A Players tab (league-wide leaderboards: goals, assists, shots, shots on target, xG, tackles, interceptions, passes, crosses, fouls, saves, clean sheets, minutes, and average match rating, with a season dropdown to view a single past season or "All Seasons" ranked by career totals or each player's single best season) and a Teams tab (the same stats plus possession, goals against, and xG against, totaled per club, with its own season dropdown for the current season and every completed one since). Match rating is an average rather than a running total, so to keep a one-off cameo from topping the chart a player needs to have appeared in at least half of the games played so far before he shows up on the match-rating board (a threshold that scales as the season goes, so it works ten games in as well as at the end).</li>
            <li><strong>Awards</strong>. Player of the Season, the Golden Boot, and a Team of the Season pitch view, one entry per completed season with a dropdown to browse past years.</li>
            <li><strong>Club History</strong>. A per-club honours page (yours by default, with a dropdown for any club in the world): a trophy case (league titles, second-tier titles, Continental Cups, promotions and relegations), individual honours won by the club's players (Player of the Season, Golden Boot, Team of the Season selections), franchise records (best finish, most points and wins in a season, all-time record), and a season-by-season table of every completed season (each season's note also shows how far the club got in that year's Continental Cup).</li>
            <li><strong>Season Preview</strong>. A snapshot of how the offseason shook out: the league's top 10 highest-rated players, top 10 highest-rated teams (both by OVR), and the top 10 biggest transfers from the summer window, ranked by fee. It opens automatically the moment you advance past a season, with a link through to Awards.</li>
            <li><strong>News Feed</strong>. Every completed transfer in the league (AI-to-AI deals included) plus player accomplishments (hat-tricks, a standout performance each matchday, and goal milestones every 10, season and career) all woven into one timeline per season, with club and season filters. Your club's items are highlighted.</li>
            <li><strong>Roster</strong>. Your squad: your Starting XI on a pitch view (with an optional Depth Chart overlay), a stats table for the XI, and a bench table (both with ratings, ages, contracts, and season stats, and goalkeepers also show goals against and xG against). Drag a bench player onto a pitch slot to swap him into the XI, extend contracts, or release players.</li>
            <li><strong>Transfers</strong>. Recommended targets you can actually afford, plus your live negotiations. Make offers, read counter-offers, close deals.</li>
            <li><strong>Incoming Offers</strong>. AI clubs bidding for <em>your</em> players. Accept, reject, or counter to push the fee upward.</li>
            <li><strong>Loans</strong>. List your own players for a fixed-length loan, look over AI clubs' incoming loan offers, and keep track of who's currently out on loan.</li>
            <li><strong>Finance</strong>. Budget, the full wage-bill table, a projected (or final) season settlement, your transfer history, and a league-wide money table.</li>
            <li><strong>Incoming Talent</strong>. Unsigned prospects age 21 or younger. Sign them to your senior team or into your academy.</li>
            <li><strong>Free Agents</strong>. Every other unsigned player, sign straight to your senior team. The default view shows the best across every position but caps how many of any one position it lists, so a spot that always has lots of free agents (defensive and attacking mids only get two roster spots per club, so their good extras spill into free agency more often) can't crowd out the rest. Pick a position from the dropdown to see that position's full list.</li>
            <li><strong>Academy</strong>. Your club's youth-academy holding pool: extend, release, or promote to the senior team.</li>
            <li><strong>Box Score</strong>. Per-match detail: goals, cards, substitutions, injuries, and a stat line (including xG, passes completed/attempted, crosses and fouls, plus goals against and xG against on the goalkeeper's row) plus a 0&ndash;10 match rating for every player who appeared, with each side's total xG next to the score. The highest-rated player among those who actually played gets starred as Man of the Match.</li>
            <li><strong>Leagues</strong>. Your saved leagues. Create, enter, or delete saves. Each one is fully independent.</li>
            <li><strong>Player Profile</strong>. Click any player's name anywhere in the game (Roster, Stat Leaders, Awards, Transfers, News Feed) to open his full career page: every attribute rating, individual and team honors (Player of the Season, Golden Boot, Team of the Season, league titles), a season-by-season stat line with columns you won't see elsewhere (shots on target, xG, goals against/xG against for keepers), full transfer history, an OVR-over-time chart (the line is colored by whichever club he was at each season and changes color when he transfers, with club crests marking transfers, and you can hover any point for that season's club and exact OVR, where a youth-academy year reads as "Club (Academy)"), and a season-by-season OVR/POT/attribute history.</li>
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
            You sim from the Dashboard in chunks: one matchday, one month, or straight to the next
            landing spot. The sim stops early whenever something needs you, especially{" "}
            <strong>deadline day</strong>, the last day of the winter transfer window, so you always
            get one last chance to deal before it shuts. Matches involving your club use your saved
            starting XI.
          </p>
          <p>After matchday 38, the offseason runs on its own, in this order:</p>
          <ol>
            <li>AI clubs renew expiring contracts for players they still rate (<a href="#ai">details</a>).</li>
            <li>Contracts that didn't get renewed expire, and those players become free agents.</li>
            <li>Retirements, usually from the mid-30s onward.</li>
            <li>Every player ages a year and develops (or declines) per the <a href="#development">development model</a>.</li>
            <li>The youth academy delivers each club's new intake (<a href="#youth">details</a>).</li>
            <li>AI clubs sign free agents, both to fill holes and to poach any that upgrade a spot they're already stocked at, then trim their squads back to 25.</li>
            <li>The summer transfer window opens and the AI-to-AI market runs.</li>
            <li>New season: budgets get settled, base allocation in and the full season's wages out (<a href="#finance">details</a>).</li>
          </ol>
          <p>
            Any lingering injuries get healed over the offseason, so anyone still hurt at the
            rollover starts the new season fit.
          </p>
        </Section>

        <Section id="world" title="The World">
          <p>
            A new save drops you into one shared world: six countries (<strong>England</strong>,{" "}
            <strong>Spain</strong>, <strong>Italy</strong>, <strong>Germany</strong>,{" "}
            <strong>France</strong> and <strong>Portugal</strong>), each with its own two-division
            pyramid (Division 1 and Division 2, 20 clubs apiece), for 12 leagues and 240 clubs total.
            You pick any club in any country and division when you start.
          </p>
          <p>
            The big four (England, Spain, Italy and Germany) are all built to the same strength and
            budget bands, so none of them is a flagship league above the others.{" "}
            <strong>France</strong> and especially <strong>Portugal</strong> are deliberately weaker
            and poorer: their clubs generate at lower OVR, and they earn and can bank less money. You
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
            grouped by country, so you can browse any of the 12 leagues. It defaults to
            whichever one your own club is currently in.
          </p>
          <p className="text-muted small">
            Saves you created before this feature shipped stay England-only forever. There's no
            mid-save world expansion.
          </p>
        </Section>

        <Section id="cup" title="The Continental Cup">
          <p>
            The Continental Cup is a 20-club competition played alongside the league season.
            Qualification is purely about <strong>league position</strong>, not squad quality. The
            top four clubs in each of the four strongest top-flight leagues (England, Spain, Italy and
            Germany) get in, plus the top two from each of the weaker leagues,{" "}
            <strong>France</strong> and <strong>Portugal</strong>. That's 4×4 + 2×2 = 20 clubs. On
            the <a href="#pages">Standings</a> page the qualifying places are shaded as the
            qualification zone (top four in a strong league, top two in a weak one).
          </p>
          <p>
            It opens with a <strong>league phase</strong>: all 20 clubs sit in one combined table and
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
            four quarter-final places. Clubs finishing <strong>13th to 20th</strong> are knocked out.
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
            Retirement becomes possible at 33 and gets more likely every year after. Declining
            veterans and marginal players go first, and a still-elite 34-year-old will often play
            on.
          </p>
          <p>
            <strong>Generational talents.</strong> Development normally gets a lot harder the better
            a player already is, and that resistance is exactly what keeps the league's elite tier
            genuinely rare. But every once in a long while (think years, not seasons), a youth
            prospect shows up somewhere in the world who's just built different. That resistance
            barely applies to him, and he can genuinely climb to heights no ordinary player reaches.
            His arrival makes the News Feed, and scouts will see the unusual ceiling in his potential
            estimate. It's a trajectory, not a guarantee, and a rough run of seasons can still leave
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
            <li><strong>Cards</strong>. Yellows, second yellows, and straight reds. Going a man down is a real hit to your side's strength for the rest of the match.</li>
            <li><strong>Set pieces</strong>. Corners, and penalty kicks resolved as a duel between the taker and the keeper (saved, scored, or dragged wide).</li>
            <li><strong>Fatigue &amp; substitutions</strong>. Players tire as the match runs, and the coach makes subs around the 60th and 75th minutes, throwing on an attacker when chasing the game. Subs aren't automatic anymore: the coach weighs how good the fresh bench player is against the tired starter he'd replace, and also how that starter is actually playing on the day. A close-quality bench refreshes freely, but he won't pull a good starter for a much weaker reserve unless that starter is genuinely gassed, so a shallow bench leaves your tired legs on. A starter tearing the game up is harder to justify hooking than one having a stinker, even at the same fitness. Your matches use the same in-match sub logic. You can also flag any bench player for <strong>More minutes</strong> on the Roster page, which tips the coach toward bringing him on more often.</li>
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
            race and not just consistency. The <strong>Golden Boot</strong> is just the league's top
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
            page. Nine shapes are on offer: <strong>4-3-3</strong>, <strong>4-4-2</strong>,{" "}
            <strong>3-5-2</strong>, <strong>5-3-2</strong>, <strong>4-2-3-1</strong>,{" "}
            <strong>4-5-1</strong>, <strong>3-4-3</strong>, <strong>5-4-1</strong>, and{" "}
            <strong>4-3-1-2</strong>. It's a real tactical choice, not just for show. Your team's
            match strength is rolled up from whichever eleven the formation fields, so a shape that
            starts two strikers (say 4-4-2) puts a different XI on the pitch than 4-3-3. Changing
            formation resets your Starting XI to the auto-picked best fit for the new shape, so you
            re-arrange from a sensible starting point. Each AI club automatically lines up in
            whichever of the nine shapes fields its own strongest eleven, re-checked at the end of
            each transfer window as its squad changes. On the Roster page, your Starting XI sits on
            a pitch, one chip per slot. Drag a bench player from the bench table onto a slot to swap
            him in, and the outgoing starter drops to the bench on its own. Click a chip to extend or
            release that player. Below the pitch is a <strong>stats table for your Starting XI</strong>{" "}
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
            <li><strong>Winter</strong>. Matchdays 18&ndash;22 (mid-December to late January). Matchday 22 is <strong>deadline day</strong>, and the "Sim to Transfer Deadline" button lands you there with the window still open.</li>
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
            <strong>List for Transfer.</strong> AI clubs already scout your whole roster on their
            own, but the "List for Transfer" button on the Roster page (in each player's pitch
            popover or bench row) lets you flag a player as available, a clearer signal that you're
            open to selling. A listed player needs a much smaller edge in value to some AI club to
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
            Interested AI clubs then make offers there, each with a flat, non-negotiable fee and the
            duration you picked. Accept one and the move goes through right away, or reject and keep
            looking. The <strong>loanee club pays the fee up front and covers his wages for the whole
            loan</strong>. His contract itself doesn't change, and once he's back he's still on the
            same deal he left with. AI clubs also loan players to each other in the background, and
            they stick strictly to real-football logic: <strong>only young players who aren't in
            their club's starting XI</strong> go out on loan. A starter is already getting his
            minutes at home, so he's never loaned, whatever the numbers say. That background market
            only ever moves players between AI clubs, so nothing happens to your own roster unless
            you list a player yourself.
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
            Don't count on picking up a gem for free, though. Each offseason the AI clubs work the
            free-agent pool before you do, and they don't just fill holes: any club will grab a
            genuinely useful free agent to upgrade a spot it's already stocked at. By the time you
            get to the Free Agents page, most of the good ones are gone and what's left skews toward
            squad filler and reclamation projects. A real bargain still turns up now and then, but
            it's the exception.
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
            so a big club's intake trends better than a small club's. On top of that anchor,{" "}
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
            outright, since the academy has no depth floor to protect, unlike your senior roster).
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
            price). Expect roughly a hundred AI transfers league-wide per season, and you can watch
            them in the News Feed.
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
            <li><strong>Deadline day is leverage.</strong> Asking prices are fixed for the whole window, so there's no discount for waiting, but "Sim to Transfer Deadline" guarantees a last look at the market (and any incoming offers) before it shuts.</li>
          </ul>
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
          <p><strong>Can I change formation?</strong> Yep. Pick from nine shapes (4-3-3, 4-4-2, 3-5-2, 5-3-2, 4-2-3-1, 4-5-1, 3-4-3, 5-4-1, 4-3-1-2) in the dropdown above the pitch on the Roster page. It changes which eleven you field (and so your match strength), and resets your Starting XI to the best fit for the new shape. Each AI club automatically uses whichever shape fields its own strongest eleven, refreshed at the end of each transfer window (summer and winter).</p>
          <p><strong>Can I go into debt?</strong> AI clubs are tuned never to. You can, by hoarding elite wages past what the base allocation covers. The Finance page shows you the shortfall before it hits. There are no debt consequences yet beyond the number itself.</p>
          <p><strong>I bought a striker in January and his whole season's stats show at my club.</strong> Season stats are one running total per player and show at his current club. There's no per-club split for mid-season movers yet. (Known quirk.)</p>
          <p><strong>A recommended target or incoming offer disappeared.</strong> Both lists are recalculated live from the state of the league, so a target can get bought by an AI club right out from under you, and an offer can drift if the bidding club's situation changes. Deals you've already agreed to are never affected.</p>
          <p><strong>Why can't I release this player?</strong> The depth floor. Releasing him would leave a position without enough cover to field a legal team. Sign or promote cover first.</p>
          <p><strong>Why did his potential drop? Scouts promised 82!</strong> Potential is a forecast that gets re-estimated over time (see <a href="#players">Players</a>). A development setback lowers the realistic ceiling, and the estimate follows it down.</p>
          <p><strong>Why is potential shown as a range like "74&ndash;88"?</strong> You never see a player's exact potential, just a scouting estimate that brackets the real value (see <a href="#players">Players</a>). Raise your <a href="#finance">scouting spend</a> to tighten it, and keep a player on your senior roster for a couple of seasons to reveal his true ceiling. The midpoint isn't the answer, the truth can sit anywhere inside the band.</p>
          <p><strong>Do AI clubs cheat?</strong> Nope. They play by the exact same rules you do: same wages, same budgets, same roster limits, same transfer machinery, no hidden income. The whole league's finances are on the Finance page if you want to check.</p>
          <p><strong>A player's profile shows the wrong club for an old league title.</strong> There's no per-season roster snapshot, so a Player Profile's "League Champion" credit is worked out from his transfer history rather than stored directly. It's reliable for anyone who's ever transferred, and a fair assumption (he stayed put) for anyone who hasn't. (Known quirk.)</p>
        </Section>
      </div>
    </div>
  );
}
