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
          Everything about how the game works, in one place. It never spoils anything hidden —
          where the game keeps a secret (like a club's asking price), the manual tells you a
          secret exists and how it behaves, not its value.
        </p>
        <p className="text-muted">
          For a quick reminder while you play, look for a small <strong>?</strong> next to a
          heading or a column like Potential, Scout value, or Power — hover (or focus) it for a
          one-line explanation. This manual is the full version of those hints.
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
            {brand} is a single-player {sport} management sim. You are the general manager of one
            club in a 20-team league: you pick the starting XI, buy and sell players, negotiate
            transfers, manage contracts and the wage bill, and try to build a squad that wins —
            this season, or three seasons from now, your call.
          </p>
          <p>
            The other 19 clubs are run by AI general managers who do all the same things you do:
            they value players, buy, sell, renew contracts, and promote youth — driven by each
            club's own situation rather than a script (see <a href="#ai">How AI Clubs Think</a>).
          </p>
          <p>
            There is no way to "win" {brand} — the game never ends. Win the league, then win it
            again. Or tear the squad down, hoard teenagers, and build a dynasty from the academy.
            Everything is simulated locally in your browser and saved automatically; you can run
            multiple league saves side by side and switch between them from the Leagues screen.
            When starting a league, "Start Customized League" lets you rename every club and set
            its abbreviation and colors before the save is created; the same editor is available
            later via "Customize Teams" on any existing save.
          </p>
          <p>
            England's 20 Division 1 clubs have real crest artwork, shown wherever a club's name
            appears; every other club (Division 2 England, Spain, Italy, Germany) shows a two-color swatch
            instead until it gets a crest of its own.
          </p>
        </Section>

        <Section id="pages" title="The Pages">
          <p>Every screen in the game and what it's for:</p>
          <ul>
            <li><strong>Dashboard</strong> — your current W/D/L record and next fixture front and center, with your division's standings to the left and the latest news headlines to the right; below that, a Stat Leaders section splits league-wide leaders from your own squad's leaders across a few key stats, and below that a finances snapshot with the scouting-spend slider and the sim buttons.</li>
            <li><strong>Standings</strong> — the league table, plus each club's current OVR/POT. A season dropdown lets you look up any past season's final table alongside the current one; the champion's row is highlighted, and the top-four <a href="#cup">Continental Cup</a> qualification places are shaded.</li>
            <li><strong>Continental Cup</strong> — the live knockout bracket for the current season, plus past winners via a season dropdown. See <a href="#cup">The Continental Cup</a>.</li>
            <li><strong>Power Rankings</strong> — every club in the world ranked by a blended Power score: squad OVR (Starting XI plus bench, depth-weighted, same formula as Standings' OVR column) plus a current-season form bonus or penalty. Form isn't just your record — beating a strong side counts for more than beating a weak one (and losing to a weak side hurts more than losing to a strong one), and goal difference factors in too, so a club can rank above or below its raw OVR depending on how it's actually playing. Record, goal difference, OVR, and the blended Power score are all shown side by side, with a badge showing each club's competition and its rank within it. Click a team to expand its full roster in place. The rankings are also snapshotted every 5 matchdays (plus once after the final matchday), and a dropdown lets you browse any past snapshot from any season — with arrows showing how far each club rose or fell since the previous snapshot. Historical views can't expand rosters, since past squads aren't stored; snapshots only accrue from the point this feature shipped onward.</li>
            <li><strong>Schedule</strong> — every matchday's fixtures and results; click a played match for its box score.</li>
            <li><strong>Stat Leaders</strong> — a Players tab (league-wide leaderboards: goals, assists, shots, shots on target, xG, tackles, interceptions, saves, clean sheets, minutes, and average match rating, with a season dropdown to view a single past season or "All Seasons" ranked by career totals or each player's single best season) and a Teams tab (the same stats plus possession, goals against, and xG against, totaled per club, with its own season dropdown for the current season and every completed one since).</li>
            <li><strong>Awards</strong> — Player of the Season, the Golden Boot, and a Team of the Season pitch view, one entry per completed season with a dropdown to browse past years.</li>
            <li><strong>Club History</strong> — a per-club honours page (yours by default, with a dropdown for any club in the world): a trophy case (league titles, second-tier titles, promotions and relegations), individual honours won by the club's players (Player of the Season, Golden Boot, Team of the Season selections), franchise records (best finish, most points and wins in a season, all-time record), and a season-by-season table of every completed season.</li>
            <li><strong>Season Preview</strong> — a snapshot of how the offseason shook out: the league's top 10 highest-rated players, top 10 highest-rated teams (both by OVR), and the top 10 biggest transfers completed during the summer window, ranked by fee. Opens automatically the moment you advance past a season, with a link through to Awards.</li>
            <li><strong>News Feed</strong> — every completed transfer in the league (AI-to-AI deals included) plus player accomplishments — hat-tricks, a standout performance each matchday, and goal milestones every 10 (season and career) — interleaved into one timeline per season, with club and season filters. Your club's items are highlighted.</li>
            <li><strong>Roster</strong> — your squad: your Starting XI on a pitch view (with an optional Depth Chart overlay) plus a bench table with ratings, ages, contracts, season stats (goalkeepers additionally show goals against and xG against). Drag a bench player onto a pitch slot to swap them into the XI, extend contracts, or release players.</li>
            <li><strong>Transfers</strong> — recommended targets you can actually afford, plus your live negotiations. Make offers, read counter-offers, close deals.</li>
            <li><strong>Incoming Offers</strong> — AI clubs bidding for <em>your</em> players. Accept, reject, or counter to squeeze the fee upward.</li>
            <li><strong>Loans</strong> — list your own players for a fixed-length loan, review AI clubs' incoming loan offers, and track who's currently out on loan.</li>
            <li><strong>Finance</strong> — budget, the full wage-bill table, a projected (or final) season settlement, your transfer history, and a league-wide money table.</li>
            <li><strong>Incoming Talent</strong> — unsigned prospects age 21 or younger; sign them to your senior team or into your academy.</li>
            <li><strong>Free Agents</strong> — every other unsigned player, sign straight to your senior team.</li>
            <li><strong>Academy</strong> — your club's youth-academy holding pool: extend, release, or promote to the senior team.</li>
            <li><strong>Box Score</strong> — per-match detail: goals, cards, substitutions, injuries, and a stat line (including xG, plus goals against and xG against on the goalkeeper's row) plus 0–10 match rating for every player who appeared, with each side's total xG shown next to the score. The highest-rated player among those who actually played is starred as Man of the Match.</li>
            <li><strong>Leagues</strong> — your saved leagues. Create, enter, or delete saves; each is fully independent.</li>
            <li><strong>Player Profile</strong> — click any player's name anywhere in the game (Roster, Stat Leaders, Awards, Transfers, News Feed) to open a full career page: every attribute rating, individual and team honors (Player of the Season, Golden Boot, Team of the Season, league titles), a season-by-season stat line including columns not shown elsewhere (shots on target, xG, goals against/xG against for keepers), full transfer history, an OVR-over-time chart (the line is colored by the club he was at each season and changes color when he transfers, with club crests marking transfers; hover any point for that season's club and exact OVR — a youth-academy year reads as "Club (Academy)"), and a season-by-season OVR/POT/attribute history.</li>
          </ul>
        </Section>

        <Section id="season" title="The Season & Simming">
          <p>
            A season is a double round-robin: 38 matchdays from August to May, every club playing
            every other home and away. Win = 3 points, draw = 1. Alongside the league, the world's
            best clubs contest the <a href="#cup">Continental Cup</a> on fixed matchdays. Every
            save's first season is displayed as 2026, advancing one year each time you go to the
            offseason.
          </p>
          <p>
            <strong>Historic seasons.</strong> Very occasionally, a club's whole season just
            clicks — or falls apart. A rare hidden form swing can carry a squad well above (or
            below) what its ratings say for one season only: the source of the runaway
            record-points champion, and of the collapse nobody saw coming. It's season-long and
            season-scoped — ratings, values, and wages are untouched, and next year the club is
            back to its true level. Your club is as eligible as any other, in both directions.
          </p>
          <p>
            You sim from the Dashboard in chunks: one matchday, one month, or straight to the next
            landing spot. The sim stops early at moments that need you — notably <strong>deadline
            day</strong>, the last day of the winter transfer window, so you always get a final
            chance to deal before it shuts. Matches involving your club use your saved starting XI.
          </p>
          <p>After matchday 38, the offseason runs automatically, in this order:</p>
          <ol>
            <li>AI clubs proactively renew expiring contracts for players they still rate (<a href="#ai">details</a>).</li>
            <li>Contracts that weren't renewed expire; those players become free agents.</li>
            <li>Retirements — likely from the mid-30s onward.</li>
            <li>Every player ages a year and develops (or declines) per the <a href="#development">development model</a>.</li>
            <li>The youth academy delivers each club's new intake (<a href="#youth">details</a>).</li>
            <li>AI clubs sign free agents to fill holes, then trim their squads back to 25.</li>
            <li>The summer transfer window opens and the AI-to-AI market runs.</li>
            <li>New season: budgets are settled — base allocation in, the full season's wages out (<a href="#finance">details</a>).</li>
          </ol>
          <p>
            Lingering injuries are healed over the offseason, and any player still hurt at the
            rollover starts the new season fit.
          </p>
        </Section>

        <Section id="world" title="The World">
          <p>
            A new save is set in one shared world: four countries — <strong>England</strong>,{" "}
            <strong>Spain</strong>, <strong>Italy</strong>, and <strong>Germany</strong> — each with
            its own two-division pyramid (Division 1 and Division 2, 20 clubs apiece), for 8 leagues
            and 160 clubs total.
            You pick any club in any country and division when you start a new save.
          </p>
          <p>
            Every country is generated to the same strength and budget bands — there's no
            "flagship league" richer or stronger than the others. Division 2 in any country
            generates weaker than its own Division 1, exactly like the domestic second division
            always has; a real, structural gap is deliberately maintained across a whole dynasty
            (see the ceiling mechanism below), not just at creation.
          </p>
          <p>
            <strong>One global transfer market.</strong> The AI transfer market, free agency,
            recommended transfers, and inbound offers for your own players all operate across every
            country with no home-country bias — an Italian club can and will buy a Spanish player,
            sign an English free agent, or bid on one of yours, exactly as if they shared a single
            league. A strong Division 2 player anywhere in the world can also be pulled up to a
            Division 1 club by the same mechanism that already applies domestically (see the
            "Wants a move to Division 1" note in <a href="#ai">How AI Clubs Think</a>) — it isn't
            limited to his own country.
          </p>
          <p>
            Promotion and relegation (3 up, 3 down) runs independently within each country at the
            end of every season — a poor season in Spain's top flight has no effect on England's,
            Italy's, or Germany's tables. Standings, Awards, and Stat Leaders each have a competition
            dropdown, grouped by country, to browse any of the 8 leagues; it defaults to whichever one
            your own club currently plays in.
          </p>
          <p className="text-muted small">
            Existing saves created before this feature shipped stay England-only forever — there's
            no mid-save world expansion.
          </p>
        </Section>

        <Section id="cup" title="The Continental Cup">
          <p>
            The Continental Cup is a 16-team knockout played alongside the league season. The top
            four clubs in each of the four top-flight leagues (England, Spain, Italy and Germany)
            qualify — 4 × 4 = 16. Qualification is purely by <strong>league position</strong>, not
            squad quality: finish in your league's top four and you're in, however good or bad your
            OVR. On the <a href="#pages">Standings</a> page those top-four places are shaded as the
            qualification zone.
          </p>
          <p>
            Because qualification comes from a completed table, the cup runs a season behind: the
            first Continental Cup is in your world's <strong>second season</strong>, seeded from
            season one's final tables. Season one has no cup.
          </p>
          <p>
            It's a single-leg bracket over four rounds — Round of 16, Quarter-finals, Semi-finals,
            Final — played on matchdays 8, 16, 26 and 34. The draw is seeded by finishing position
            (the four league champions are the top seeds and kept apart until late). A tie level
            after 90 minutes goes to extra time, then a penalty shootout if still level, so every
            tie produces a winner. Rounds are played automatically as the season reaches them; the{" "}
            <strong>Continental Cup</strong> page shows the live bracket, with your club highlighted.
          </p>
          <p>
            Prize money is real and paid as you advance: every entrant banks a participation fee,
            and each round you win pays more than the last. Going all the way is worth roughly £48M
            in total to the champion and about £24M to the runner-up — enough to reshape a transfer
            budget, on top of your normal league finances.
          </p>
          <p>
            Cup matches are their own competition: goals, assists and appearances there are tracked
            <strong>separately</strong> from your league stats (they don't feed Stat Leaders, the
            end-of-season awards, or player development). You'll find a club's cup record under the
            <strong>Cup</strong> tab on any <a href="#players">player's profile</a>.
          </p>
          <p>
            One convenience: if your club reaches the final, simming to the end of the season
            <strong>stops just before the final</strong> so you don't blow past it — check your
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
            Under the hood each player has 14 individual ratings on a 1–99 scale — four physical
            (speed, strength, stamina, jumping), and ten technical/mental (short passing, long
            passing, crossing, dribbling, long shots, finishing, tackling, interceptions,
            positioning, goalkeeping).
          </p>
          <p>
            <strong>OVR</strong> is a position-weighted blend of those ratings — a striker's OVR
            leans on finishing and speed, a center back's on tackling, positioning, and strength.
            The scale is deliberately tight:
          </p>
          <ul>
            <li><strong>65</strong> — an average starter</li>
            <li><strong>70</strong> — a good starter</li>
            <li><strong>75</strong> — typically a team's best player</li>
            <li><strong>80–85</strong> — a league-wide elite player</li>
            <li><strong>90+</strong> — a rare, generational outlier</li>
          </ul>
          <p>
            <strong>Potential is a scout's estimate, not a promise.</strong> The game simulates a
            player's future career many times over and reports the 75th percentile of the simulated
            peaks — so roughly three players in four never quite reach their listed potential, and
            one in four meets or beats it. Crucially, potential has <em>zero</em> influence on how a
            player actually develops; it's a forecast of the development model, not an input to it.
            It gets re-estimated as the player ages, so it drifts toward his current OVR over time.
          </p>
          <p>
            <strong>You don't see a player's exact potential — you see a scouting estimate.</strong>{" "}
            Everywhere POT appears (Roster, prospects, free agents, transfer targets, rival squads,
            player profiles), it's shown as a low–high band rather than a single number, and the
            true value always sits somewhere inside that band. Two things narrow the band toward the
            exact figure. First, your <a href="#finance">scouting spend</a>: more scouting means a
            tighter estimate straight away. Second, time on your own senior roster: a player you own
            sharpens on his own over about two to three seasons until his POT is fully known (higher
            scouting spend gets you there faster). Prospects, free agents, and other clubs' players
            are never on your roster, so they stay at their foggiest until you scout harder — or sign
            them. Current OVR and individual attribute ratings are always shown exactly; only
            potential is fogged.
          </p>
          <p>
            <strong>Team OVR and POT</strong> (shown on Standings and at the top of your Roster
            page) aren't a plain average of the whole squad — like a strong bench beats a stacked
            bench of scrubs in real football, your starting XI counts in full, and each bench
            player behind them counts for progressively less the further down the depth chart he
            sits. A deep, talented bench genuinely lifts the number; fringe reserves barely move
            it.
          </p>
        </Section>

        <Section id="development" title="Player Development & Aging">
          <p>
            Players develop each offseason based on age and randomness — nothing else. The typical
            arc peaks around <strong>age 26</strong>, but not all of a player evenly:
          </p>
          <ul>
            <li><strong>Physical ratings</strong> (speed, strength, stamina, jumping) peak earlier and decline first — a 30-year-old winger loses his legs before his touch.</li>
            <li><strong>Technical and mental ratings</strong> peak later and fade slower.</li>
            <li><strong>Goalkeepers</strong> age the most gracefully of all — careers routinely run deep into the 30s.</li>
          </ul>
          <p>
            Development is noisy, and much noisier when young: an 18-year-old can jump several
            points in a season (or stall completely), while a 30-year-old's year-to-year change is
            small and mostly downhill. Playing time gives a modest nudge to a growing player's
            development — regular minutes help, rotting on the bench hurts a little — but it never
            overrides the age curve.
          </p>
          <p>
            Retirement becomes possible at 33 and grows more likely each year after. Declining
            veterans and marginal players go first; a still-elite 34-year-old may well play on.
          </p>
          <p>
            <strong>Generational talents.</strong> Development normally gets much harder the
            better a player already is — that resistance is what keeps the league's elite tier
            genuinely rare. But every once in a long while (think years, not seasons), a youth
            prospect arrives somewhere in the world who is simply built different: development
            resistance barely applies to him, and he can genuinely climb to heights no ordinary
            player reaches. His arrival makes the News Feed, and scouts will see the unusual
            ceiling in his potential estimate. It's a trajectory, not a guarantee — a rough run
            of seasons can still leave him merely very good — but these players are where the
            game's true legends come from. If one lands in <em>your</em> academy, treat him
            accordingly.
          </p>
        </Section>

        <Section id="matches" title="The Match Engine">
          <p>
            Matches are simulated event by event, and everything below shows up in the box score:
          </p>
          <ul>
            <li><strong>Goals & assists</strong> — attributed to individual players, weighted by who's actually on the pitch and how good they are.</li>
            <li><strong>Cards</strong> — yellows, second yellows, and straight reds. Going a man down is a real penalty to your side's strength for the rest of the match.</li>
            <li><strong>Set pieces</strong> — corners, and penalty kicks resolved as a duel between the taker and the keeper (saved, scored, or dragged wide).</li>
            <li><strong>Fatigue & substitutions</strong> — players tire as the match runs; the AI coach makes subs around the 60th and 75th minutes, throwing on an attacker when chasing the game. Your matches use the same in-match sub logic.</li>
            <li><strong>Injuries</strong> — a player can go down mid-match and miss 1–6 matches. Recovery ticks down as you sim; he returns automatically.</li>
            <li><strong>Stoppage time</strong> — scaled to how eventful the half was.</li>
          </ul>
          <p>
            When the XI changes mid-match — sub, red card, injury — the team's effective strength
            is recomputed from who is actually on the pitch, so losing your best center back at
            minute 20 genuinely hurts for the remaining 70.
          </p>
          <p>
            <strong>Match ratings.</strong> Every appearance earns a FotMob-style 0.0–10.0 rating,
            starting from a 6.0 baseline and moving with the player's stat line, weighted by
            position — a clean sheet means more to a keeper, a goal to a defender is worth more
            than a goal to a striker. Short cameos are damped by minutes played, so a two-minute
            sub can't post a 9.8 off one touch. The season-long average is a sortable column on
            Stat Leaders.
          </p>
          <p>
            <strong>End-of-season awards.</strong> The moment you advance past a season, you land on
            the Season Preview page (a quick look at the league's top players, top teams, and
            biggest offseason transfers), with a link through to the Awards page for three honors
            covering the season that just finished. <strong>Player
            of the Season</strong> starts from a player's season-long average match rating, then adds
            an extra bonus for his goals and assists — weighted more heavily than the match rating
            alone already credits them, and heavier still for a defender or keeper who chips in
            goals — so end product genuinely tips a close race, not just consistency. The
            <strong> Golden Boot</strong> is simply the league's top league-goals scorer. <strong>Team
            of the Season</strong> fills an 11-man pitch (one XI slot per position) with whoever
            rates highest at that position across the whole league, blending match rating with the
            stats that matter most for that role — goals and assists up front, tackles and
            interceptions in defense and midfield, saves for the keeper. Both Player of the Season
            and Team of the Season also factor in overall quality, not just the stat line — a
            modest player who racked up a big statistical season (often from facing heavy pressure
            on a weaker side) won't out-rank a genuinely elite one. Only players who appeared in a
            meaningful share of the season's matchdays are eligible for any of the three.
          </p>
          <p>
            <strong>xG (expected goals).</strong> Every shot's pre-outcome chance of going in,
            based on the defense and keeper it's taken against, is tallied per player and per
            team, shown next to the score on the Box Score page and as a column on Stat Leaders.
            It deliberately ignores the shooter's own finishing skill — an elite finisher's
            shots don't get marked as higher-quality chances just because he's elite — so
            comparing a player's actual goals to his xG tells you whether he's finishing above
            or below what an average attacker would from the same opportunities, rather than the
            two numbers just tracking each other. It's purely informational: it doesn't feed
            match ratings or anything else, it just tells you whether a scoreline flattered a
            team (or a keeper) or was earned.
          </p>
          <p>
            <strong>Goals against &amp; xG against.</strong> The mirror stat for goalkeepers: how
            many goals he's actually conceded versus how many an average keeper would be expected
            to concede from the shots he faced, shown on his Roster row, his Box Score line, and
            as Team Stat Leaders columns. A keeper conceding fewer goals than his xG against is
            outperforming his shot-stopping expectation; more means the defense in front of him
            is doing well but he isn't converting that into saves, or he's been unlucky.
            Goalkeepers can't currently be substituted mid-match, so both stats always cover a
            keeper's full 90 minutes.
          </p>
        </Section>

        <Section id="squad" title="Your Squad: Lineups, Depth & the Roster Cap">
          <p>
            Pick your <strong>formation</strong> from the dropdown above the pitch on the Roster
            page. Nine shapes are available — <strong>4-3-3</strong>, <strong>4-4-2</strong>,{" "}
            <strong>3-5-2</strong>, <strong>5-3-2</strong>, <strong>4-2-3-1</strong>,{" "}
            <strong>4-5-1</strong>, <strong>3-4-3</strong>, <strong>5-4-1</strong>, and{" "}
            <strong>4-3-1-2</strong>. It's a real tactical choice, not just a display: your team's
            match strength is rolled up from whichever eleven the formation fields, so a shape that
            starts two strikers (say 4-4-2) puts a different XI on the pitch than 4-3-3. Changing
            formation resets your Starting XI to the auto-picked best fit for the new shape, so you
            can re-arrange from a sensible starting point. Each AI club automatically lines up in
            whichever of the nine shapes lets it field its own strongest eleven, re-evaluated at the
            end of each transfer window as its squad changes. On
            the Roster page, your Starting XI is shown on a pitch, one chip per slot; drag a bench
            player from the table below the pitch onto a slot to swap them in — the outgoing
            starter drops to the bench automatically. Click a chip to extend or release that
            player. A <strong>Depth Chart</strong> toggle above the pitch shows each starter's
            current best-fit backup from the bench alongside their chip. Each chip also shows a
            small ▲/▼ badge next to a starter's OVR when it changed from the previous season —
            green for growth, red for decline — so you can spot who's developing or fading without
            leaving the pitch view. Your XI persists and is used every match. If your saved XI ever becomes invalid — a starter is sold, injured,
            or released — the game transparently falls back to auto-picking the best available XI,
            so you're never fielding a ghost. The bench is the best 7 remaining players by OVR.
          </p>
          <p>
            <strong>Roster cap: 30 players.</strong> Signings, transfer buys, and academy
            promotions are blocked once you're full (the Roster, Transfers, and Incoming Talent
            pages all show an x/30 count). Your academy has its own separate 10-player cap — see{" "}
            <a href="#youth">The Youth Academy</a>.
          </p>
          <p>
            <strong>Depth floor.</strong> You can't sell or release a player if it would leave a
            position with too little cover to field a team — the game blocks the move rather than
            letting you strand yourself without, say, a goalkeeper. AI clubs obey the same floor.
          </p>
        </Section>

        <Section id="transfers" title="Transfers & Negotiation">
          <p>Two transfer windows per season, mirroring real football:</p>
          <ul>
            <li><strong>Summer</strong> — the whole offseason plus matchdays 1–4 (closes early September).</li>
            <li><strong>Winter</strong> — matchdays 18–22 (mid-December to late January). Matchday 22 is <strong>deadline day</strong>; the "Sim to Transfer Deadline" button lands you there with the window still open.</li>
          </ul>
          <p>
            <strong>Market value.</strong> A player's value climbs steeply with OVR (an average
            starter runs $35–45M, an elite player can top $150M), then gets multiplied by age
            (youth is a premium in this market — you're buying years of control and resale value;
            value peaks in the late teens and falls hard after 28), by potential headroom (a big
            gap between potential and current OVR commands a real premium for young players,
            fading to nothing by 30), and by remaining contract length (a player locked up for
            years is pricier to pry loose).
          </p>
          <p>
            <strong>Buying.</strong> The Transfers page recommends 5–10 for-sale players near your
            level and within your means — how accurately they're ranked depends on your scouting
            spend (<a href="#finance">Finance</a>). The filters (position, min OVR, min potential,
            max age, max value) re-run the search rather than just hiding rows, so pinning a
            position brings up a fresh, fuller list of players there. Negotiation works like this: the selling club
            has a hidden asking price, rolled once per window (so you can't reopen talks hoping
            for a cheaper mood). Offer far below it and they hang up for the rest of the window.
            Offer low-but-plausible and they counter above their true price, conceding less each
            round. Repeating an offer they already rejected, or dragging past five rounds, ends
            talks. Meet the price and the deal executes on the spot — fee out of your budget,
            player on your roster.
          </p>
          <p>
            <strong>Selling.</strong> During a window, AI clubs that rate your players will make
            offers — up to 4 at a time, from whichever club values each player most (
            <a href="#ai">how they decide</a>). You can accept (immediate sale, fee into your
            budget), reject, or counter upward: the buyer haggles by exactly the same rules you
            face when buying, just mirrored, and walks away from greedy counters the same way a
            seller would. Sold players appear in a "Sold This Window" section so deals never
            vanish silently. Each offer comes with a one-line scout take — a straight "take it,"
            a suggested counter price, or a dismissive "not worth discussing" — reflecting your
            scout's read of the offer against the player's value to your club; like Recommended
            Transfers, how sharp that read is depends on your scouting spend (<a href="#finance">Finance</a>).
          </p>
          <p>
            <strong>List for Transfer.</strong> AI clubs already scout your whole roster on their
            own, but a "List for Transfer" button on the Roster page (in each player's pitch popover
            or bench row) lets you flag a player as available — a clearer signal that you're
            willing to sell. A listed player needs a much smaller edge in value to some AI club to
            draw a bid, and gets first claim on one of the 4 offer slots each window over an
            unlisted player. It's not a guarantee — a buyer still has to rate him above what he's
            worth to you — just better odds of a bite.
          </p>
          <p>
            Every completed transfer in the league — yours and the AI's — lands in the News Feed.
          </p>
        </Section>

        <Section id="loans" title="Loans">
          <p>
            A loan sends one of your players to another club's roster for a fixed <strong>1, 2, or
            3 seasons</strong> without selling him — he plays for (and develops at) his loanee club
            the whole time, then comes back to you automatically once the loan ends. It's the tool
            for a good player stuck behind a better one on your own depth chart: real minutes matter
            for development, so a season out on loan can be worth more to him than a season on your
            bench.
          </p>
          <p>
            From the Loans page, <strong>list</strong> a senior-roster player and pick a duration
            (the depth floor still applies — you can't loan away your last cover at a position).
            Interested AI clubs then make offers there, each with a flat, non-negotiable fee and the
            duration you chose; accept one and the move executes immediately, or reject to keep
            looking. The <strong>loanee club pays the fee up front and covers his wages for the
            whole loan</strong> — his contract itself doesn't change, and once he's back he's still
            under the same deal he left with. AI clubs also loan players to each other in the
            background, and they follow the real-football logic strictly: <strong>only young
            players who aren't in their club's starting XI</strong> go out on loan — a starter is
            already getting his minutes at home, so he's never loaned, however the numbers shake
            out. That background market only ever moves players between AI clubs; nothing happens
            to your own roster unless you list a player yourself.
          </p>
        </Section>

        <Section id="contracts" title="Contracts, Wages & Free Agents">
          <p>
            Contracts are one-button: the game shows you the exact weekly wage and length, and you
            take it or leave it — no salary haggling. Length is set by age: <strong>3 years</strong>{" "}
            under 30, <strong>2 years</strong> at 30–32, <strong>1 year</strong> at 33+. Academy
            players are the exception — see <a href="#youth">The Youth Academy</a> for their flat
            stipend, which doesn't follow this age/ovr scale.
          </p>
          <p>
            Wages scale steeply with ability — superstar money is real money. Roughly, per week
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
            A player whose contract expires becomes a <strong>free agent</strong> — signable for no
            transfer fee, just wages, via the same one-button terms. Extend your own players from
            the Roster page before they walk — pick any length from 1 to 4 seasons, wage unaffected
            by length; the AI extends its own keepers too (<a href="#ai">details</a>), so the
            free-agent pool is mostly players somebody decided not to keep.
          </p>
          <p>
            If you run a Division 2 club, an occasional breakout player will refuse a new deal —
            the Roster page shows "Wants a move to Division 1" instead of an Extend button once
            he's genuinely good enough that a Division 1 club would want him. He can't be extended
            or blocked from leaving; the best you can do is sell him yourself before his contract
            runs out, since letting him walk for free gets you nothing. The same logic runs in the
            other direction too: <strong>Division 2 clubs never buy players of that caliber</strong>{" "}
            — not from each other, and not from you — a player good enough for the top flight
            simply wouldn't sign for the second division, so don't expect a Division 2 club among
            the bidders for your stars.
          </p>
        </Section>

        <Section id="finance" title="Finance">
          <p>
            Every club starts each season with the same base allocation (<strong>$110M</strong>),
            and the squad's <strong>entire season wage bill is paid up front</strong> at the season
            start. What's left is genuinely spendable — on transfer fees, mid-season signings, and
            scouting. A mid-season acquisition (transfer buy or free-agent signing) charges the
            player's full season salary at the moment you get him, on top of any fee.
          </p>
          <p>At season's end, the settlement adds and subtracts the rest:</p>
          <ul>
            <li><strong>Prize money</strong> — $40M for winning the league, $20M for finishing 2nd–5th, $10M for 6th–10th, nothing below that.</li>
            <li><strong>Hype revenue</strong> — every club has a hype score (0–100) that drifts toward its recent results rather than snapping to them. Hype earns extra revenue (up to ~$30M at maximum hype), deliberately damped so fame stays a bonus, not an engine — success payouts matter more.</li>
            <li><strong>Scouting spend</strong> — whatever you set the slider to comes out here.</li>
          </ul>
          <p>
            <strong>Scouting</strong> is one slider, $0–20M per season, defaulting to $5M. You
            set it <em>once a year, in the offseason</em>, and it's locked for the whole season it
            applies to (deducted at that season's end); during the season the slider is disabled.
            That's deliberate: you commit to the spend — and pay for it — before you get the
            sharper view, so you can't crank it up to peek at a player and turn it straight back
            down. It buys accuracy, not players: every value you see on a transfer target
            (Recommended Transfers, negotiation offers, incoming offers for your own players) is a{" "}
            <em>perceived</em> value, not the true one, and how far off it can be depends on your
            spend. At $0 it's noisy (±35% — a target that looks like a bargain, or a rip-off, may
            just be a bad read), at the $20M max it's nearly exact (±5%). Spend also controls the{" "}
            <a href="#players">potential (POT) fog</a>: more scouting narrows every player's
            estimated-potential band and reveals a signing's true ceiling sooner. So plan ahead —
            if you expect a busy transfer year, set your scouting budget high in the offseason
            before it.
          </p>
          <p>
            The Finance page shows all of it: current budget, hype, the wage-bill table, a
            settlement projection (final numbers once the season ends), your complete transfer
            history, and a league-wide money table for comparison — a competition dropdown
            (grouped by country) scopes that table, defaulting to whichever competition your own
            club currently plays in, with an "All Competitions" option to see every club in the
            world at once. AI clubs are tuned to never go broke;
            <em> you</em> can overspend — hoard a full roster of elite wages and the projection
            will happily show you the shortfall coming. Budget is a running balance that carries
            over between seasons rather than resetting. The savings cap scales with a club's fame:
            a top-flight club can bank up to <strong>$400M</strong> at full hype, down to
            <strong> $200M</strong> for a club with no fame (Division 2 clubs are capped lower on top
            of that, reflecting the financial gap between divisions) — spending below your cap is
            unrestricted, but you can't bank cash past it.
          </p>
        </Section>

        <Section id="youth" title="The Youth Academy">
          <p>
            Every offseason, your club's academy produces <strong>3–5 new 16-year-olds</strong>,
            landing in a holding pool on the Academy page rather than straight onto your senior
            roster. They arrive raw — well below first-team level — but with youth on their side,
            some will develop into stars (and some won't; see <a href="#players">potential</a>).
          </p>
          <p>
            Academy quality starts from a fixed trait of each club, set when the league is
            created — a big club's intake trends better than a small club's. On top of that
            anchor, <strong>recent results move the needle</strong>: young players want to join a
            club that's been winning, so finishing high in your league over the last few seasons
            nudges your intake quality up, and finishing low nudges it down. It's a modest pull,
            not a transformation — sustained success at the top of the table is worth a few
            points of intake quality versus sustained struggle, judged over roughly the last
            three seasons, and it fades as results normalize. Buying a great squad doesn't do
            it; the results themselves are what count.
          </p>
          <p>
            Academy players draw a cheap flat weekly stipend instead of the normal wage formula
            and can't be transferred. Each has a one-button <strong>Extend</strong> (fresh
            stipend terms once their contract enters its final season) or <strong>Release</strong>{" "}
            (cut them outright — the academy has no depth floor to protect, unlike your senior
            roster). When one is ready, <strong>Promote</strong> moves him onto your senior roster
            on a normal ovr-based wage; this is blocked once you're at the 30-man roster cap. The
            academy has its own cap, separate from your senior roster's — 10 prospects.
          </p>
          <p>
            AI clubs don't hold a real academy pool — their youth intake still lands straight on
            their senior roster and gets trimmed back to target depth like any other offseason
            surplus. If you leave your own academy untouched for several seasons while your senior
            roster shrinks (retirements, expiring contracts you don't re-sign), the game will
            automatically call up your best academy prospects — goalkeeper first if you have none
            at all — to keep your squad fieldable. This is a last-resort safety net, not a normal
            way to build your squad; check in on the Academy page regularly instead.
          </p>
          <p>
            Prospects age 21 or younger who were never on any club's academy or roster show up on
            the <strong>Incoming Talent</strong> page instead, where you can sign them straight to
            your senior team or into your academy. Older free agents are on the separate{" "}
            <strong>Free Agents</strong> page.
          </p>
        </Section>

        <Section id="ai" title="How AI Clubs Think">
          <p>
            AI clubs don't follow scripts ("big club buys stars, small club sells"). Instead, each
            club continuously derives its outlook from its actual situation:
          </p>
          <ul>
            <li><strong>Ambition</strong> — win-now pressure, blended from wealth, fame, squad strength, and recent form. An ambitious club pays up for prime-age quality; a low-ambition club builds young.</li>
            <li><strong>Frugality</strong> — financial caution, driven by relative wealth. Rich clubs absorb expensive mistakes; poor clubs can't and price accordingly.</li>
          </ul>
          <p>
            When an AI club evaluates a player, it starts from his open-market value and adjusts
            for its own needs: <strong>positional need</strong> (thin at his position and he'd be
            an upgrade? worth more; surplus there? worth less), <strong>timeline fit</strong>{" "}
            (does his age match the club's ambition?), and <strong>affordability</strong> (a deal
            that eats too much of the budget is discounted, more sharply for frugal clubs). Two
            clubs looking at the same player genuinely value him differently.
          </p>
          <p>
            <strong>The AI-to-AI market</strong> runs once per window on one rule: a player's
            asking price is what he's worth <em>to his own club</em>, and he moves to whichever
            club values him meaningfully more than that and can afford the fee (which splits the
            difference between the two valuations). Everything you'd expect emerges from that
            single rule with no special cases — surplus players get dumped, aging stars get sold
            at peak the moment their keep-value dips below their market price, and needy clubs
            overpay for scarce positions. Guardrails keep it sane: clubs won't auction
            irreplaceable core players, cap themselves at 3 buys and 3 sells per window, always
            respect the depth floor and roster cap, and hold back a cash reserve rather than
            spending to zero. Expect roughly a hundred AI transfers league-wide per season — watch
            them in the News Feed.
          </p>
          <p>
            <strong>Contract renewals.</strong> Before contracts expire each offseason, every AI
            club re-signs any expiring player it still values above his new wage, using the same
            one-button terms you get. Players who fail that bar — too old, too expensive, squad
            surplus — are let go into free agency. So an AI club's good young players rarely walk
            for free, but a declining veteran on superstar wages will.
          </p>
          <p>
            AI valuations also carry a little noise — clubs aren't omniscient, and the "best"
            bidder doesn't always win a player.
          </p>
        </Section>

        <Section id="strategy" title="Strategy">
          <p>Think like a real sporting director:</p>
          <ul>
            <li><strong>Age is an asset class.</strong> A 21-year-old and a 29-year-old at the same OVR are very different purchases: the young one keeps his resale value (and may still grow); the veteran's value falls every season. Buy young, sell before the decline.</li>
            <li><strong>Watch the wage bill, not just fees.</strong> Wages scale steeply with OVR and come out of your budget up front. A squad of 80s can out-wage your income even if you never pay a transfer fee — the Finance page projects exactly where you'll land.</li>
            <li><strong>Sell into demand.</strong> Incoming offers come from clubs that need your player, and their first bid is rarely their best. Counter once or twice before accepting — but greedy counters end talks.</li>
            <li><strong>Decide your scouting spend a year ahead.</strong> It sharpens valuations, target rankings, and potential estimates, but you set it in the offseason and it's locked for the season — so if you're planning a busy transfer year, budget for scouting the offseason before, and dial it down for a quiet one.</li>
            <li><strong>Potential is a forecast, not a fact.</strong> Most players fall short of it. Paying a big potential premium is a real gamble — that's the game working as intended.</li>
            <li><strong>Deadline day is leverage.</strong> Asking prices are fixed for the whole window, so there's no discount for waiting — but "Sim to Transfer Deadline" guarantees a last look at the market (and at any incoming offers) before the window shuts.</li>
          </ul>
        </Section>

        <Section id="faq" title="FAQ & Known Quirks">
          <p><strong>How do I win?</strong> You don't — the game never ends. Set your own goal: a title, a decade of dominance, an all-academy XI.</p>
          <p><strong>Where can I see that a player is injured?</strong> Injured players automatically sit out until recovered, but there's no injury badge on the Roster page yet — if a regular quietly misses matches, that's usually why. (Known gap.)</p>
          <p><strong>Can I change formation?</strong> Yes — pick from nine shapes (4-3-3, 4-4-2, 3-5-2, 5-3-2, 4-2-3-1, 4-5-1, 3-4-3, 5-4-1, 4-3-1-2) in the dropdown above the pitch on the Roster page. It changes which eleven you field (and therefore your match strength), and resets your Starting XI to the best fit for the new shape. Each AI club automatically uses whichever shape fields its own strongest eleven, refreshed at the end of each transfer window (summer and winter).</p>
          <p><strong>Can I go into debt?</strong> AI clubs are tuned never to; you can, by hoarding elite wages past what the base allocation covers. The Finance page projects the shortfall before it happens. There are no debt consequences yet beyond the number itself.</p>
          <p><strong>I bought a striker in January and his whole season's stats show at my club.</strong> Season stats are one running total per player and display at his current club — there's no per-club split for mid-season movers yet. (Known quirk.)</p>
          <p><strong>A recommended target / incoming offer disappeared.</strong> Both lists are recomputed live from the state of the league, so a target can be bought by an AI club out from under you, and an offer can drift if the bidding club's situation changes. Deals you've already agreed are never affected.</p>
          <p><strong>Why can't I release this player?</strong> The depth floor — releasing him would leave a position without enough cover to field a legal team. Sign or promote cover first.</p>
          <p><strong>Why did his potential drop? Scouts promised 82!</strong> Potential is a periodically re-estimated forecast (see <a href="#players">Players</a>). A development setback lowers the realistic ceiling, and the estimate follows.</p>
          <p><strong>Why is potential shown as a range like "74–88"?</strong> You never see a player's exact potential — only a scouting estimate that brackets the true value (see <a href="#players">Players</a>). Raise your <a href="#finance">scouting spend</a> to narrow it, and keep a player on your senior roster for a couple of seasons to reveal his true ceiling. The band's midpoint isn't the answer — the truth can sit anywhere inside it.</p>
          <p><strong>Do AI clubs cheat?</strong> No. They play by exactly your rules: same wages, same budgets, same roster limits, same transfer machinery, no hidden income. The whole league's finances are on the Finance page if you want to audit them.</p>
          <p><strong>A player's profile shows the wrong club for an old league title.</strong> There's no per-season roster snapshot, so a Player Profile's "League Champion" credit is reconstructed from his transfer history rather than stored directly — reliable for anyone who's ever transferred, and a reasonable assumption (he stayed put) for anyone who hasn't. (Known quirk.)</p>
        </Section>
      </div>
    </div>
  );
}
