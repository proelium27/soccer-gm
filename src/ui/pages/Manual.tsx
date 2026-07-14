import type { ReactNode } from "react";

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
  ["players", "Players: Ratings, OVR & Potential"],
  ["development", "Player Development & Aging"],
  ["matches", "The Match Engine"],
  ["squad", "Your Squad: Lineups, Depth & the Roster Cap"],
  ["transfers", "Transfers & Negotiation"],
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
  return (
    <div className="container-fluid p-3">
      <h4>Manual</h4>
      <div style={{ maxWidth: "56rem" }}>
        <p className="text-muted">
          Everything about how the game works, in one place. It never spoils anything hidden —
          where the game keeps a secret (like a club's asking price), the manual tells you a
          secret exists and how it behaves, not its value.
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
            Soccer GM is a single-player soccer management sim. You are the general manager of one
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
            There is no way to "win" Soccer GM — the game never ends. Win the league, then win it
            again. Or tear the squad down, hoard teenagers, and build a dynasty from the academy.
            Everything is simulated locally in your browser and saved automatically; you can run
            multiple league saves side by side and switch between them from the Leagues screen.
          </p>
        </Section>

        <Section id="pages" title="The Pages">
          <p>Every screen in the game and what it's for:</p>
          <ul>
            <li><strong>Dashboard</strong> — your record, next fixtures, a finances snapshot with the scouting-spend slider, and the sim buttons.</li>
            <li><strong>Standings</strong> — the league table. A season dropdown lets you look up any past season's final table alongside the current one; the champion's row is highlighted.</li>
            <li><strong>Schedule</strong> — every matchday's fixtures and results; click a played match for its box score.</li>
            <li><strong>Stat Leaders</strong> — a Players tab (league-wide leaderboards: goals, assists, shots, shots on target, xG, tackles, interceptions, saves, clean sheets, minutes, and average match rating, with a season dropdown to view a single past season or "All Seasons" ranked by career totals or each player's single best season) and a Teams tab (the same stats plus possession, goals against, and xG against, totaled per club, with its own season dropdown for the current season and every completed one since).</li>
            <li><strong>Awards</strong> — Player of the Season, the Golden Boot, and a Team of the Season pitch view, one entry per completed season with a dropdown to browse past years. Opens automatically the moment you advance past a season.</li>
            <li><strong>News Feed</strong> — every completed transfer in the league (AI-to-AI deals included), newest first, grouped by season, with club and season filters. Your club's deals are highlighted.</li>
            <li><strong>Roster</strong> — your squad: your Starting XI on a pitch view (with an optional Depth Chart overlay) plus a bench table with ratings, ages, contracts, season stats (goalkeepers additionally show goals against and xG against). Drag a bench player onto a pitch slot to swap them into the XI, extend contracts, or release players.</li>
            <li><strong>Transfers</strong> — recommended targets you can actually afford, plus your live negotiations. Make offers, read counter-offers, close deals.</li>
            <li><strong>Incoming Offers</strong> — AI clubs bidding for <em>your</em> players. Accept, reject, or counter to squeeze the fee upward.</li>
            <li><strong>Finance</strong> — budget, the full wage-bill table, a projected (or final) season settlement, your transfer history, and a league-wide money table.</li>
            <li><strong>Incoming Talent</strong> — this season's youth-academy intake.</li>
            <li><strong>Box Score</strong> — per-match detail: goals, cards, substitutions, injuries, and a stat line (including xG, plus goals against and xG against on the goalkeeper's row) plus 0–10 match rating for every player who appeared, with each side's total xG shown next to the score. The highest-rated player among those who actually played is starred as Man of the Match.</li>
            <li><strong>Leagues</strong> — your saved leagues. Create, enter, or delete saves; each is fully independent.</li>
          </ul>
        </Section>

        <Section id="season" title="The Season & Simming">
          <p>
            A season is a double round-robin: 38 matchdays from August to May, every club playing
            every other home and away. Win = 3 points, draw = 1. There are no cups or continental
            competitions (yet) — the league is the whole calendar. Every save's first season is
            displayed as 2026, advancing one year each time you go to the offseason.
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
            <strong>End-of-season awards.</strong> The moment you advance past a season, the Awards
            page opens automatically with three honors for the season that just finished. <strong>Player
            of the Season</strong> starts from a player's season-long average match rating, then adds
            an extra bonus for his goals and assists — weighted more heavily than the match rating
            alone already credits them, and heavier still for a defender or keeper who chips in
            goals — so end product genuinely tips a close race, not just consistency. The
            <strong> Golden Boot</strong> is simply the league's top league-goals scorer. <strong>Team
            of the Season</strong> fills an 11-man pitch (one XI slot per position) with whoever
            rates highest at that position across the whole league, blending match rating with the
            stats that matter most for that role — goals and assists up front, tackles and
            interceptions in defense and midfield, saves for the keeper. Only players who
            appeared in a meaningful share of the season's matchdays are eligible for any of the
            three.
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
            The formation is <strong>4-3-3</strong> (a formation picker hasn't been built yet). On
            the Roster page, your Starting XI is shown on a pitch, one chip per slot; drag a bench
            player from the table below the pitch onto a slot to swap them in — the outgoing
            starter drops to the bench automatically. Click a chip to extend or release that
            player. A <strong>Depth Chart</strong> toggle above the pitch shows each starter's
            current best-fit backup from the bench alongside their chip. Your XI persists and is
            used every match. If your saved XI ever becomes invalid — a starter is sold, injured,
            or released — the game transparently falls back to auto-picking the best available XI,
            so you're never fielding a ghost. The bench is the best 7 remaining players by OVR.
          </p>
          <p>
            <strong>Roster cap: 30 players.</strong> Signings and transfer buys are blocked once
            you're full (the Roster, Transfers, and Incoming Talent pages all show an x/30 count).
            Youth intake can briefly push you over — you just can't <em>acquire</em> anyone else
            until a slot opens.
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
            spend (<a href="#finance">Finance</a>). Negotiation works like this: the selling club
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
            vanish silently.
          </p>
          <p>
            Every completed transfer in the league — yours and the AI's — lands in the News Feed.
          </p>
        </Section>

        <Section id="contracts" title="Contracts, Wages & Free Agents">
          <p>
            Contracts are one-button: the game shows you the exact weekly wage and length, and you
            take it or leave it — no salary haggling. Length is set by age: <strong>3 years</strong>{" "}
            under 30, <strong>2 years</strong> at 30–32, <strong>1 year</strong> at 33+. Youth
            intake arrives on 2-year deals.
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
            the Roster page before they walk; the AI extends its own keepers too (
            <a href="#ai">details</a>), so the free-agent pool is mostly players somebody decided
            not to keep.
          </p>
        </Section>

        <Section id="finance" title="Finance">
          <p>
            Every club starts each season with the same base allocation (<strong>$50M</strong>),
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
            <strong>Scouting</strong> is one slider, $0–20M per season. It buys accuracy, not
            players: at zero spend your perceived player valuations are noisy (±35%), at max spend
            nearly exact (±5%). That noise is what shuffles the Recommended Transfers ranking —
            cheap scouting means the "best" target on the list sometimes isn't.
          </p>
          <p>
            The Finance page shows all of it: current budget, hype, the wage-bill table, a
            settlement projection (final numbers once the season ends), your complete transfer
            history, and every club's budget for comparison. AI clubs are tuned to never go broke;
            <em> you</em> can overspend — hoard a full roster of elite wages and the projection
            will happily show you the shortfall coming. Budget is a running balance that carries
            over between seasons rather than resetting, capped at <strong>$300M</strong> — spending
            below that line is unrestricted, but a club can't bank cash past it.
          </p>
        </Section>

        <Section id="youth" title="The Youth Academy">
          <p>
            Every offseason, each club's academy produces <strong>3–5 new 16-year-olds</strong>,
            shown on the Incoming Talent page. They arrive raw — well below first-team level — but
            with youth on their side, some will develop into stars (and some won't; see{" "}
            <a href="#players">potential</a>).
          </p>
          <p>
            Academy quality is a fixed trait of each club, set when the league is created — a big
            club's intake trends better than a small club's, but your academy doesn't get better
            or worse as your first team does. Youth intake ignores the roster cap on arrival, so a
            full squad can briefly sit above 30 until you clear space.
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
            <li><strong>Scouting spend is only worth it when you're shopping.</strong> It sharpens valuations and target rankings. In a season where you don't plan to buy, slide it down and pocket the difference.</li>
            <li><strong>Potential is a forecast, not a fact.</strong> Most players fall short of it. Paying a big potential premium is a real gamble — that's the game working as intended.</li>
            <li><strong>Deadline day is leverage.</strong> Asking prices are fixed for the whole window, so there's no discount for waiting — but "Sim to Transfer Deadline" guarantees a last look at the market (and at any incoming offers) before the window shuts.</li>
          </ul>
        </Section>

        <Section id="faq" title="FAQ & Known Quirks">
          <p><strong>How do I win?</strong> You don't — the game never ends. Set your own goal: a title, a decade of dominance, an all-academy XI.</p>
          <p><strong>Where can I see that a player is injured?</strong> Injured players automatically sit out until recovered, but there's no injury badge on the Roster page yet — if a regular quietly misses matches, that's usually why. (Known gap.)</p>
          <p><strong>Can I change formation?</strong> Not yet — everyone plays 4-3-3. A formation picker is a likely future feature.</p>
          <p><strong>Can I go into debt?</strong> AI clubs are tuned never to; you can, by hoarding elite wages past what the base allocation covers. The Finance page projects the shortfall before it happens. There are no debt consequences yet beyond the number itself.</p>
          <p><strong>I bought a striker in January and his whole season's stats show at my club.</strong> Season stats are one running total per player and display at his current club — there's no per-club split for mid-season movers yet. (Known quirk.)</p>
          <p><strong>A recommended target / incoming offer disappeared.</strong> Both lists are recomputed live from the state of the league, so a target can be bought by an AI club out from under you, and an offer can drift if the bidding club's situation changes. Deals you've already agreed are never affected.</p>
          <p><strong>Why can't I release this player?</strong> The depth floor — releasing him would leave a position without enough cover to field a legal team. Sign or promote cover first.</p>
          <p><strong>Why did his potential drop? Scouts promised 82!</strong> Potential is a periodically re-estimated forecast (see <a href="#players">Players</a>). A development setback lowers the realistic ceiling, and the estimate follows.</p>
          <p><strong>Do AI clubs cheat?</strong> No. They play by exactly your rules: same wages, same budgets, same roster limits, same transfer machinery, no hidden income. The whole league's finances are on the Finance page if you want to audit them.</p>
        </Section>
      </div>
    </div>
  );
}
