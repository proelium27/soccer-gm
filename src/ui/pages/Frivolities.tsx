import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { computeRecordBook, type TeamSeasonRecord, type TransferRecord } from "../../core/frivolities/records.js";
import {
  computePlayerBios, type BioRow, type NameCount, type NationalityRow, type OneClubMan,
} from "../../core/frivolities/bios.js";
import { computeClubTrivia, type ClubRecordRow, type ClubSpendRow } from "../../core/frivolities/clubs.js";
import type { CareerRow } from "../../core/frivolities/careers.js";
import { allTimeLeaders, type LeaderScope } from "../../core/frivolities/leaders.js";
import {
  allTimeInternational, cappedNationalities,
  INTL_ALL_TIME_KEYS, type IntlAllTimeKey,
} from "../../core/frivolities/international.js";
import {
  playerGoatRanking, teamGoatRanking,
  type GoatComponent, type PlayerGoatRow, type TeamGoatRow,
} from "../../core/frivolities/goat.js";
import { ALL_TIME_STAT_KEYS, type AllTimeStatKey } from "../../core/frivolities/stats.js";
import { ClubCrest } from "../components/ClubCrest.js";
import { Flag } from "../components/Flag.js";
import { currency, seasonYear } from "../format.js";

type Tab = "goat" | "records" | "leaders" | "international" | "bios" | "clubs";

const TAB_LABELS: Record<Tab, string> = {
  goat: "GOAT",
  records: "Records",
  leaders: "All-Time Leaders",
  international: "International",
  bios: "Player Bios",
  clubs: "Club Records",
};

/** Display labels for the ranked stats, matching the per-season Stat Leaders page's wording. */
const STAT_LABELS: Record<AllTimeStatKey, string> = {
  goals: "Goals",
  assists: "Assists",
  shots: "Shots",
  shotsOnTarget: "Shots on Target",
  xg: "xG",
  saves: "Saves",
  tackles: "Tackles",
  interceptions: "Interceptions",
  passes: "Passes",
  crosses: "Crosses",
  foulsCommitted: "Fouls",
  minutesPlayed: "Minutes",
  appearances: "Appearances",
  avgRating: "Match Rating",
};

/** Stats that read better with a decimal than as a whole number. */
const DECIMAL_STATS = new Set<AllTimeStatKey>(["xg", "avgRating"]);

function formatStat(stat: AllTimeStatKey, value: number): string {
  return DECIMAL_STATS.has(stat)
    ? value.toFixed(stat === "avgRating" ? 2 : 1)
    : Math.round(value).toLocaleString();
}

/** A titled card wrapping one list, with an optional line of explanation under the heading. */
function Panel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="card h-100">
      <div className="card-body">
        <h6 className="card-title text-muted text-uppercase small mb-1">{title}</h6>
        {note && <p className="text-secondary small mb-2">{note}</p>}
        {children}
      </div>
    </div>
  );
}

function Empty({ what }: { what: string }) {
  return <p className="text-muted small mb-0">No {what} yet.</p>;
}

/**
 * A club name with its crest. Falls back to the tid when a club can't be found,
 * which can only happen for a save whose team list has changed under a
 * historical record.
 */
function ClubCell({ tid }: { tid: number | null }) {
  const { league } = useLeague();
  if (tid == null) return <span className="text-muted">Unattached</span>;
  const team = league?.teams.find((t) => t.tid === tid);
  return (
    <span className="d-inline-flex align-items-center gap-1">
      <ClubCrest tid={tid} colors={team?.colors ?? ["#888888", "#888888"]} />
      {team?.name ?? `Team ${tid}`}
    </span>
  );
}

/**
 * A player's name, linked to his profile only while he still exists.
 *
 * A retiree is deleted from the pool, so his profile route would render an
 * empty page — the archive keeps his name and record, not a page to visit.
 */
function PlayerCell({ pid, name, nationality, active }: {
  pid: number;
  name: string;
  nationality?: string;
  active?: boolean;
}) {
  return (
    <span className="d-inline-flex align-items-center gap-1">
      {/* Falsy for a player the save no longer knows (see TransferRecord.nationality) —
          the Flag fallback swatch would imply a country we don't actually have. */}
      {nationality ? <Flag nationality={nationality} tip={false} /> : null}
      {active === false
        ? <span>{name}</span>
        : <Link to={`/player/${pid}`}>{name}</Link>}
      {active === false && <span className="badge text-bg-secondary">Retired</span>}
    </span>
  );
}

/**
 * A compact ranked table: rank, a label cell, and one or more value columns.
 *
 * `expand` opts a table into click-to-reveal detail rows, the same interaction
 * Power Rankings uses for rosters. Only one row is open at a time — these
 * details are wide, and several open at once turns the board into a wall.
 */
function RankTable<T>({ rows, headers, render, empty, expand }: {
  rows: T[];
  headers: string[];
  render: (row: T) => ReactNode[];
  empty: string;
  expand?: (row: T) => ReactNode;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (rows.length === 0) return <Empty what={empty} />;
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0">
        <thead>
          <tr>
            <th className="text-muted" style={{ width: "2.5rem" }}>#</th>
            {headers.map((h, i) => (
              <th key={h} className={i === 0 ? "" : "text-end"}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const cells = render(row);
            const isOpen = open === i;
            return (
              <Fragment key={i}>
                <tr
                  onClick={expand ? () => setOpen(isOpen ? null : i) : undefined}
                  style={expand ? { cursor: "pointer" } : undefined}
                  className={isOpen ? "table-active" : undefined}
                >
                  <td className="text-muted">{i + 1}</td>
                  {cells.map((c, j) => (
                    <td key={j} className={j === 0 ? "" : "text-end"}>{c}</td>
                  ))}
                </tr>
                {isOpen && expand && (
                  <tr className="table-active">
                    <td colSpan={headers.length + 1} className="pt-0">
                      {expand(row)}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Two panels side by side on wide screens, stacked on mobile. */
function Row({ children }: { children: ReactNode }) {
  return <div className="row g-3 mb-3">{children}</div>;
}
function Col({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={wide ? "col-12" : "col-12 col-lg-6"}>{children}</div>;
}

// --- GOAT ------------------------------------------------------------------

/**
 * The parts a GOAT score is made of, in the order they're shown.
 *
 * Order and membership come from the data (`row.components`), not this table —
 * this only supplies wording. A component with no entry here still shows, under
 * its key, rather than silently vanishing from a total it contributes to.
 */
const PART_LABELS: Record<string, { label: string; help: string }> = {
  peak: { label: "Peak", help: "highest rating reached" },
  prime: { label: "Prime", help: "years spent near that peak" },
  longevity: { label: "Career", help: "seasons played and sustained match rating" },
  awards: { label: "Awards", help: "individual honours" },
  trophies: { label: "Trophies", help: "titles won with club and country" },
  production: { label: "Extras", help: "goals, assists and caps" },
};

/** Wording for each line of arithmetic inside a component. */
const TERM_LABELS: Record<string, string> = {
  peakOvr: "rating above 70 at his peak",
  primeOvr: "rating above 70, added up across every season",
  seasons: "seasons played",
  rating: "match rating above 6.0, scaled by how much he played",
  ballonDOr: "Ballon d'Or",
  playerOfSeason: "Player of the Season",
  worldXI: "World Team of the Year",
  goldenBoot: "Golden Boot",
  teamOfSeason: "Team of the Season",
  worldCups: "World Cup",
  cupTitles: "Continental Cup",
  leagueTitles: "league title",
  goals: "goals",
  assists: "assists",
  caps: "caps",
  topFinishes: "top-four finishes",
  topFlightSeasons: "seasons in the top flight",
  ppgSurplus: "points per game above 1.40, added up across every season",
  secondTierTitles: "second-tier title",
};

function partLabel(key: string): string {
  return PART_LABELS[key]?.label ?? key;
}

/** A number that reads cleanly whether it's a count of trophies or a rating surplus. */
function termCount(count: number): string {
  return Number.isInteger(count) ? String(count) : count.toFixed(2);
}

/** Term points are exact, so show the decimal rather than a figure that won't multiply out. */
function termPoints(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(1);
}

/**
 * The full working behind one row's score: every component, every term, and the
 * `count x weight = points` that produced it.
 */
function GoatBreakdown({ components, score }: { components: GoatComponent[]; score: number }) {
  return (
    <div className="small">
      <div className="text-muted mb-2">
        How this score was worked out. Every line is how many, times what each one is worth.
        Each part is rounded to a whole number, so its lines can add up a fraction off.
      </div>
      <div className="row g-3">
        {components.filter((c) => c.terms.length > 0).map((c) => (
          <div key={c.key} className="col-12 col-md-6 col-lg-4">
            <div className="d-flex justify-content-between border-bottom mb-1">
              <strong>{partLabel(c.key)}</strong>
              <strong>{c.points}</strong>
            </div>
            {c.terms.map((t) => (
              <div key={t.key} className="d-flex justify-content-between gap-2 text-muted">
                <span>
                  {TERM_LABELS[t.key] ?? t.key}: {termCount(t.count)} x {t.weight}
                </span>
                <span className="text-nowrap">{termPoints(t.points)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="d-flex justify-content-between border-top mt-2 pt-1">
        <strong>Total</strong>
        <strong>{score}</strong>
      </div>
    </div>
  );
}

function GoatTab() {
  const { league } = useLeague();
  const [side, setSide] = useState<"players" | "clubs">("players");
  const players = useMemo(() => (league ? playerGoatRanking(league) : []), [league]);
  const clubs = useMemo(() => (league ? teamGoatRanking(league) : []), [league]);
  if (!league) return null;

  return (
    <>
      <p className="text-secondary small">
        Ranked by a fixed formula weighing peak rating, years spent near that peak, career length
        and match rating, individual awards, trophies, and goals and assists.
      </p>

      <ul className="nav nav-pills nav-sm mb-3">
        {(["players", "clubs"] as const).map((s) => (
          <li key={s} className="nav-item">
            <button
              className={`nav-link ${side === s ? "active" : ""}`}
              onClick={() => setSide(s)}
            >
              {s === "players" ? "Players" : "Clubs"}
            </button>
          </li>
        ))}
      </ul>

      {/* Keyed on `side` so switching boards remounts the table. Without it the
          open-row index carries across, and the Clubs board opens with a row
          already expanded because a player row was open. */}
      {side === "players" ? (
        <Panel
          key="players"
          title="Greatest players of all time"
          note="Click on a row to see the full score breakdown"
        >
          <RankTable
            rows={players}
            headers={[
              "Player", "Club", "Best OVR",
              ...(players[0]?.components ?? []).map((c) => partLabel(c.key)),
              "Score",
            ]}
            render={(r: PlayerGoatRow) => [
              <PlayerCell
                pid={r.career.pid}
                name={r.career.name}
                nationality={r.career.nationality}
                active={r.career.active}
              />,
              <ClubCell tid={r.career.tid} />,
              // Labelled "Best OVR", not "Peak": the Peak column beside it is a
              // score component derived from this, and calling both "peak" made
              // the row unreadable.
              r.career.peakOvr,
              // Columns come from the row's own components, so a component can
              // never count toward the score without appearing here.
              ...r.components.map((c) => <span className="text-muted">{c.points}</span>),
              <strong>{r.score}</strong>,
            ]}
            expand={(r: PlayerGoatRow) => (
              <GoatBreakdown components={r.components} score={r.score} />
            )}
            empty="careers"
          />
        </Panel>
      ) : (
        <Panel
          key="clubs"
          title="Greatest clubs of all time"
          note="Click on a row to see the full score breakdown"
        >
          <RankTable
            rows={clubs}
            headers={["Club", "Titles", "Cups", "Top 4", "Seasons", "PPG", "Score"]}
            render={(r: TeamGoatRow) => [
              <ClubCell tid={r.tid} />,
              r.leagueTitles,
              r.cupTitles,
              r.topFinishes,
              r.seasons,
              r.ppg.toFixed(2),
              <strong>{r.score}</strong>,
            ]}
            expand={(r: TeamGoatRow) => (
              <GoatBreakdown components={r.components} score={r.score} />
            )}
            empty="completed seasons"
          />
        </Panel>
      )}
    </>
  );
}

// --- Records ---------------------------------------------------------------

function teamSeasonCells(r: TeamSeasonRecord): ReactNode[] {
  return [
    <ClubCell tid={r.tid} />,
    seasonYear(r.season),
    r.tier === 2 ? "D2" : "D1",
    `${r.row.won}-${r.row.drawn}-${r.row.lost}`,
    r.row.points,
    r.ppg.toFixed(2),
  ];
}

function careerCells(c: CareerRow, value: ReactNode, extra?: ReactNode): ReactNode[] {
  return [
    <PlayerCell pid={c.pid} name={c.name} nationality={c.nationality} active={c.active} />,
    <ClubCell tid={c.tid} />,
    ...(extra === undefined ? [] : [extra]),
    value,
  ];
}

function RecordsTab() {
  const { league } = useLeague();
  const book = useMemo(() => (league ? computeRecordBook(league) : null), [league]);
  if (!league || !book) return null;

  const careerHeaders = (last: string, extra?: string) =>
    ["Player", "Club", ...(extra ? [extra] : []), last];

  return (
    <>
      <Row>
        <Col>
          <Panel
            title="Most dominant seasons"
            note="Ranked by points per game, so a season in a smaller league isn't punished for playing fewer matches."
          >
            <RankTable
              rows={book.bestTeamSeasons}
              headers={["Club", "Season", "Div", "W-D-L", "Pts", "PPG"]}
              render={teamSeasonCells}
              empty="completed seasons"
            />
          </Panel>
        </Col>
        <Col>
          <Panel title="Worst team seasons" note="The other end of the same list.">
            <RankTable
              rows={book.worstTeamSeasons}
              headers={["Club", "Season", "Div", "W-D-L", "Pts", "PPG"]}
              render={teamSeasonCells}
              empty="completed seasons"
            />
          </Panel>
        </Col>
      </Row>

      <Row>
        <Col>
          <Panel title="Highest rating ever reached">
            <RankTable
              rows={book.peakRatings}
              headers={careerHeaders("Peak", "Season")}
              render={(c) => careerCells(c, c.peakOvr, seasonYear(c.peakSeason))}
              empty="rated seasons"
            />
          </Panel>
        </Col>
        <Col>
          <Panel title="Longest careers">
            <RankTable
              rows={book.longestCareers}
              headers={careerHeaders("Seasons", "Apps")}
              render={(c) => careerCells(c, c.seasonsPlayed, c.totals.appearances)}
              empty="careers"
            />
          </Panel>
        </Col>
      </Row>

      <Row>
        <Col wide>
          <Panel title="Biggest transfer fees" note="Permanent deals only. Loans and free moves aren't purchases.">
            <RankTable
              rows={book.biggestTransfers}
              headers={["Player", "From", "To", "Season", "Fee"]}
              render={(t: TransferRecord) => [
                <PlayerCell pid={t.pid} name={t.name} nationality={t.nationality} />,
                <ClubCell tid={t.fromTid} />,
                <ClubCell tid={t.toTid} />,
                seasonYear(t.season),
                currency.format(t.fee),
              ]}
              empty="transfers"
            />
          </Panel>
        </Col>
      </Row>
    </>
  );
}

// --- All-time leaders ------------------------------------------------------

function LeadersTab() {
  const { league } = useLeague();
  const [stat, setStat] = useState<AllTimeStatKey>("goals");
  const [scope, setScope] = useState<LeaderScope>("career");

  const rows = useMemo(
    () => (league ? allTimeLeaders(league, stat, scope) : []),
    [league, stat, scope],
  );
  if (!league) return null;

  return (
    <>
      <p className="text-secondary small">
        Every club in the world at once, not one league at a time, because a career crosses
        divisions and countries. Retired players are included where the game kept a record
        of them.
      </p>

      <div className="mb-3 d-flex gap-2 flex-wrap">
        <select
          className="form-select form-select-sm"
          style={{ width: "auto" }}
          value={scope}
          onChange={(e) => setScope(e.target.value as LeaderScope)}
          aria-label="Career or single season"
        >
          <option value="career">Career</option>
          <option value="single">Single season</option>
        </select>
        <select
          className="form-select form-select-sm"
          style={{ width: "auto" }}
          value={stat}
          onChange={(e) => setStat(e.target.value as AllTimeStatKey)}
          aria-label="Stat"
        >
          {ALL_TIME_STAT_KEYS.map((k) => (
            <option key={k} value={k}>{STAT_LABELS[k]}</option>
          ))}
        </select>
      </div>

      <Panel
        title={scope === "career" ? `Career ${STAT_LABELS[stat]}` : `Best season: ${STAT_LABELS[stat]}`}
        note={scope === "single"
          ? "One row per player: his best season, so a single career can't fill the whole board."
          : undefined}
      >
        <RankTable
          rows={rows}
          headers={scope === "career"
            ? ["Player", "Club", "Apps", STAT_LABELS[stat]]
            : ["Player", "Club", "Season", "Apps", STAT_LABELS[stat]]}
          render={(r) => [
            <PlayerCell
              pid={r.career.pid}
              name={r.career.name}
              nationality={r.career.nationality}
              active={r.career.active}
            />,
            <ClubCell tid={r.career.tid} />,
            ...(scope === "single" ? [seasonYear(r.season ?? 0)] : []),
            r.appearances,
            formatStat(stat, r.value),
          ]}
          empty="recorded seasons"
        />
      </Panel>
    </>
  );
}

// --- International ---------------------------------------------------------

const INTL_STAT_LABELS: Record<IntlAllTimeKey, string> = {
  intlGoals: "Goals",
  caps: "Caps",
  intlTitles: "World Cups",
};

/**
 * What an empty board is missing, per stat.
 *
 * Stat-specific on purpose: before the first World Cup there are plenty of
 * capped players but no winners, so a shared "no capped players yet" would be
 * simply untrue on that board.
 */
const INTL_EMPTY_LABELS: Record<IntlAllTimeKey, string> = {
  intlGoals: "international goals",
  caps: "capped players",
  intlTitles: "World Cup winners",
};

function InternationalTab() {
  const { league } = useLeague();
  const [key, setKey] = useState<IntlAllTimeKey>("intlGoals");
  const [country, setCountry] = useState("");

  const countries = useMemo(() => (league ? cappedNationalities(league) : []), [league]);
  const rows = useMemo(
    () => (league ? allTimeInternational(league, key, country || null) : []),
    [league, key, country],
  );
  if (!league) return null;

  return (
    <>
      <p className="text-secondary small">
        National-team records for every player the save still knows about, retired ones included.
        A country's all-time top scorer is almost always someone who has already hung up his
        boots, so this is the one board that would be close to meaningless without them. Caps and
        goals cover a whole international career, qualifying and World Cups together, exactly as
        they read on a player's profile.
      </p>

      <div className="mb-3 d-flex gap-2 flex-wrap">
        <select
          className="form-select form-select-sm"
          style={{ width: "auto" }}
          value={key}
          onChange={(e) => setKey(e.target.value as IntlAllTimeKey)}
          aria-label="Stat"
        >
          {INTL_ALL_TIME_KEYS.map((k) => (
            <option key={k} value={k}>{INTL_STAT_LABELS[k]}</option>
          ))}
        </select>
        <select
          className="form-select form-select-sm"
          style={{ width: "auto" }}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          aria-label="Country"
        >
          <option value="">Every country</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <Panel title={country ? `${country}: all-time ${INTL_STAT_LABELS[key]}` : `All-time ${INTL_STAT_LABELS[key]}`}>
        <RankTable
          rows={rows}
          headers={["Player", "Club", "Caps", "Goals", "World Cups"]}
          render={(r: CareerRow) => [
            <PlayerCell pid={r.pid} name={r.name} nationality={r.nationality} active={r.active} />,
            <ClubCell tid={r.tid} />,
            // The ranked column reads bold, so it's obvious which one the order follows.
            <span className={key === "caps" ? "fw-bold" : undefined}>{r.caps}</span>,
            <span className={key === "intlGoals" ? "fw-bold" : undefined}>{r.intlGoals}</span>,
            <span className={key === "intlTitles" ? "fw-bold" : undefined}>
              {r.intlTitles || <span className="text-muted">&ndash;</span>}
            </span>,
          ]}
          empty={INTL_EMPTY_LABELS[key]}
        />
      </Panel>
    </>
  );
}

// --- Player bios -----------------------------------------------------------

function bioCells(b: BioRow, value: ReactNode): ReactNode[] {
  return [
    <PlayerCell pid={b.pid} name={b.name} nationality={b.nationality} />,
    <ClubCell tid={b.tid} />,
    b.pos,
    value,
  ];
}

function BiosTab() {
  const { league } = useLeague();
  const bios = useMemo(() => (league ? computePlayerBios(league) : null), [league]);
  if (!league || !bios) return null;

  const headers = (last: string) => ["Player", "Club", "Pos", last];

  return (
    <>
      <Row>
        <Col>
          <Panel title="Oldest">
            <RankTable rows={bios.oldest} headers={headers("Age")}
              render={(b) => bioCells(b, b.age)} empty="players" />
          </Panel>
        </Col>
        <Col>
          <Panel title="Youngest">
            <RankTable rows={bios.youngest} headers={headers("Age")}
              render={(b) => bioCells(b, b.age)} empty="players" />
          </Panel>
        </Col>
      </Row>

      <Row>
        <Col wide>
          <Panel
            title="Where everyone comes from"
            note="Every country with a player in the world right now, biggest contingent first."
          >
            <RankTable
              rows={bios.nationalities}
              headers={["Country", "Players", "On a roster", "Avg rating", "Best player"]}
              render={(n: NationalityRow) => [
                <span className="d-inline-flex align-items-center gap-1">
                  <Flag nationality={n.nationality} tip={false} />
                  {n.nationality}
                </span>,
                n.count,
                n.rostered,
                n.avgOvr.toFixed(1),
                n.best
                  ? <PlayerCell pid={n.best.pid} name={n.best.name} nationality={n.best.nationality} />
                  : <span className="text-muted">None</span>,
              ]}
              empty="players"
            />
          </Panel>
        </Col>
      </Row>

      <Row>
        <Col>
          <Panel title="One-club men" note="Players who have only ever played for one club.">
            <RankTable
              rows={bios.oneClubMen}
              headers={["Player", "Club", "Seasons", "Apps"]}
              render={(m: OneClubMan) => [
                <PlayerCell pid={m.career.pid} name={m.career.name}
                  nationality={m.career.nationality} active={m.career.active} />,
                <ClubCell tid={m.tid} />,
                m.career.seasonsPlayed,
                m.career.totals.appearances,
              ]}
              empty="careers"
            />
          </Panel>
        </Col>
      </Row>

      <Row>
        <Col>
          <Panel title="Longest names">
            <RankTable rows={bios.longestNames} headers={headers("Letters")}
              render={(b) => bioCells(b, b.name.length)} empty="players" />
          </Panel>
        </Col>
        <Col>
          <Panel title="Most common names" note="Names shared by more than one player right now.">
            <div className="row g-3">
              <div className="col-6">
                <div className="text-muted small mb-1">First names</div>
                <RankTable rows={bios.commonFirstNames} headers={["Name", "Players"]}
                  render={(n: NameCount) => [n.name, n.count]} empty="repeated first names" />
              </div>
              <div className="col-6">
                <div className="text-muted small mb-1">Surnames</div>
                <RankTable rows={bios.commonSurnames} headers={["Name", "Players"]}
                  render={(n: NameCount) => [n.name, n.count]} empty="repeated surnames" />
              </div>
            </div>
          </Panel>
        </Col>
      </Row>
    </>
  );
}

// --- Club trivia -----------------------------------------------------------

function ClubsTab() {
  const { league } = useLeague();
  const trivia = useMemo(() => (league ? computeClubTrivia(league) : null), [league]);
  if (!league || !trivia) return null;

  if (trivia.seasonsRecorded === 0) {
    return (
      <div className="alert alert-secondary small mb-0">
        Nothing here until you've finished a season. Come back once there's some history to pick over.
      </div>
    );
  }

  return (
    <>
      <p className="text-secondary small">
        Drawn from the {trivia.seasonsRecorded} season{trivia.seasonsRecorded === 1 ? "" : "s"} this
        save has on record.
      </p>

      <Row>
        <Col wide>
          <Panel title="Trophy cabinet">
            <RankTable
              rows={trivia.records}
              headers={[
                "Club", "Total Trophies", "D1 Championships", "Continental Cups",
                "D2 Championships", "Seasons", "Top flight",
              ]}
              render={(r: ClubRecordRow) => [
                <ClubCell tid={r.tid} />,
                <strong>{r.totalTrophies}</strong>,
                r.leagueTitles,
                r.cupTitles,
                r.secondTierTitles,
                r.seasons,
                r.topFlightSeasons,
              ]}
              empty="completed seasons"
            />
          </Panel>
        </Col>
      </Row>

      <Row>
        <Col>
          <Panel
            title="Longest wait for a title"
            note="Seasons since a club last won its top flight. A club that's never won counts its whole history."
          >
            <RankTable
              rows={trivia.droughts}
              headers={["Club", "Waiting", "Last won"]}
              render={(r: ClubRecordRow) => [
                <ClubCell tid={r.tid} />,
                `${r.titleDrought} season${r.titleDrought === 1 ? "" : "s"}`,
                r.lastTitleSeason == null
                  ? <span className="text-muted">Never</span>
                  : seasonYear(r.lastTitleSeason),
              ]}
              empty="completed seasons"
            />
          </Panel>
        </Col>
      </Row>

      <Row>
        <Col>
          <Panel title="Biggest spenders" note="All-time gross transfer spend.">
            <RankTable
              rows={trivia.biggestSpenders}
              headers={["Club", "Signings", "Spent"]}
              render={(s: ClubSpendRow) => [
                <ClubCell tid={s.tid} />,
                s.signings,
                currency.format(s.spent),
              ]}
              empty="transfers"
            />
          </Panel>
        </Col>
        <Col>
          <Panel title="Best traders" note="Fees received minus fees paid, across the whole save.">
            <RankTable
              rows={trivia.biggestSellers}
              headers={["Club", "Sales", "Net"]}
              render={(s: ClubSpendRow) => [
                <ClubCell tid={s.tid} />,
                s.sales,
                <span className={s.net >= 0 ? "text-success" : "text-danger"}>
                  {currency.format(s.net)}
                </span>,
              ]}
              empty="transfers"
            />
          </Panel>
        </Col>
      </Row>
    </>
  );
}

// --- Page ------------------------------------------------------------------

export function Frivolities() {
  const { league } = useLeague();
  const [tab, setTab] = useState<Tab>("goat");
  if (!league) return null;

  return (
    <div>
      <h1 className="h4 mb-3">Frivolities</h1>

      <ul className="nav nav-tabs mb-3">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <li key={t} className="nav-item">
            <button
              className={`nav-link ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {TAB_LABELS[t]}
            </button>
          </li>
        ))}
      </ul>

      {tab === "goat" && <GoatTab />}
      {tab === "records" && <RecordsTab />}
      {tab === "leaders" && <LeadersTab />}
      {tab === "international" && <InternationalTab />}
      {tab === "bios" && <BiosTab />}
      {tab === "clubs" && <ClubsTab />}
    </div>
  );
}
