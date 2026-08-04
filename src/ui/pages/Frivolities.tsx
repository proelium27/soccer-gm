import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext.js";
import { computeRecordBook, type TeamSeasonRecord, type TransferRecord } from "../../core/frivolities/records.js";
import { computePlayerBios, type BioRow, type NameCount, type NationalityRow } from "../../core/frivolities/bios.js";
import { computeClubTrivia, type ClubRecordRow, type ClubSpendRow, type OneClubMan } from "../../core/frivolities/clubs.js";
import type { CareerRow } from "../../core/frivolities/careers.js";
import { ClubCrest } from "../components/ClubCrest.js";
import { Flag } from "../components/Flag.js";
import { currency, seasonYear } from "../format.js";

type Tab = "records" | "bios" | "clubs";

const TAB_LABELS: Record<Tab, string> = {
  records: "Records",
  bios: "Player Bios",
  clubs: "Club Trivia",
};

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
      {nationality && <Flag nationality={nationality} tip={false} />}
      {active === false
        ? <span>{name}</span>
        : <Link to={`/player/${pid}`}>{name}</Link>}
      {active === false && <span className="badge text-bg-secondary">Retired</span>}
    </span>
  );
}

/** A compact ranked table: rank, a label cell, and one or more value columns. */
function RankTable<T>({ rows, headers, render, empty }: {
  rows: T[];
  headers: string[];
  render: (row: T) => ReactNode[];
  empty: string;
}) {
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
            return (
              <tr key={i}>
                <td className="text-muted">{i + 1}</td>
                {cells.map((c, j) => (
                  <td key={j} className={j === 0 ? "" : "text-end"}>{c}</td>
                ))}
              </tr>
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
      {!book.hasArchive && (
        <div className="alert alert-secondary small">
          These lists cover everyone still playing. Once players start retiring, the best of
          them stick around here permanently, so the all-time lists keep growing as your save does.
        </div>
      )}

      <Row>
        <Col>
          <Panel
            title="Best team seasons"
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
          <Panel title="Highest rating ever reached" note="The best any player has ever been, not what he is now.">
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
              render={(c) => careerCells(c, c.seasonsPlayed, c.appearances)}
              empty="careers"
            />
          </Panel>
        </Col>
      </Row>

      <Row>
        <Col>
          <Panel title="Most goals in a season">
            <RankTable
              rows={book.seasonGoals}
              headers={careerHeaders("Goals", "Season")}
              render={(c) => careerCells(c, c.bestGoals, seasonYear(c.bestGoalsSeason))}
              empty="league goals"
            />
          </Panel>
        </Col>
        <Col>
          <Panel title="Most assists in a season">
            <RankTable
              rows={book.seasonAssists}
              headers={careerHeaders("Assists", "Season")}
              render={(c) => careerCells(c, c.bestAssists, seasonYear(c.bestAssistsSeason))}
              empty="league assists"
            />
          </Panel>
        </Col>
      </Row>

      <Row>
        <Col>
          <Panel title="Career goals">
            <RankTable
              rows={book.careerGoals}
              headers={careerHeaders("Goals", "Apps")}
              render={(c) => careerCells(c, c.goals, c.appearances)}
              empty="league goals"
            />
          </Panel>
        </Col>
        <Col>
          <Panel title="Career assists">
            <RankTable
              rows={book.careerAssists}
              headers={careerHeaders("Assists", "Apps")}
              render={(c) => careerCells(c, c.assists, c.appearances)}
              empty="league assists"
            />
          </Panel>
        </Col>
      </Row>

      <Row>
        <Col>
          <Panel title="Career appearances">
            <RankTable
              rows={book.careerAppearances}
              headers={careerHeaders("Apps", "Seasons")}
              render={(c) => careerCells(c, c.appearances, c.seasonsPlayed)}
              empty="appearances"
            />
          </Panel>
        </Col>
        <Col>
          <Panel title="Biggest transfer fees" note="Permanent deals only — loans and free moves aren't purchases.">
            <RankTable
              rows={book.biggestTransfers}
              headers={["Player", "From", "To", "Season", "Fee"]}
              render={(t: TransferRecord) => [
                <PlayerCell pid={t.pid} name={t.name} />,
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
      <p className="text-secondary small">
        Everyone currently in the world, all {bios.poolSize.toLocaleString()} of them — academy
        players included, which is why the youngest list is full of teenagers.
      </p>

      <Row>
        <Col>
          <Panel title="Tallest">
            <RankTable rows={bios.tallest} headers={headers("Height")}
              render={(b) => bioCells(b, `${b.heightCm} cm`)} empty="players" />
          </Panel>
        </Col>
        <Col>
          <Panel title="Shortest">
            <RankTable rows={bios.shortest} headers={headers("Height")}
              render={(b) => bioCells(b, `${b.heightCm} cm`)} empty="players" />
          </Panel>
        </Col>
      </Row>

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
                  ? <PlayerCell pid={n.best.pid} name={n.best.name} />
                  : <span className="text-muted">None</span>,
              ]}
              empty="players"
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
          <Panel title="Trophy cabinet" note="League titles first, then cups.">
            <RankTable
              rows={trivia.records}
              headers={["Club", "Titles", "Cups", "D2 titles", "Seasons", "Top flight", "PPG"]}
              render={(r: ClubRecordRow) => [
                <ClubCell tid={r.tid} />,
                r.leagueTitles,
                r.cupTitles,
                r.secondTierTitles,
                r.seasons,
                r.topFlightSeasons,
                r.ppg.toFixed(2),
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
        <Col>
          <Panel title="One-club men" note="Players who've only ever turned out for a single club.">
            <RankTable
              rows={trivia.oneClubMen}
              headers={["Player", "Club", "Seasons", "Apps"]}
              render={(m: OneClubMan) => [
                <PlayerCell pid={m.career.pid} name={m.career.name}
                  nationality={m.career.nationality} active={m.career.active} />,
                <ClubCell tid={m.tid} />,
                m.career.seasonsPlayed,
                m.career.appearances,
              ]}
              empty="careers"
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
  const [tab, setTab] = useState<Tab>("records");
  if (!league) return null;

  return (
    <div>
      <h1 className="h4 mb-1">Frivolities</h1>
      <p className="text-secondary small">
        The stuff that doesn't help you win anything. All-time lists, odd trivia, and the
        records your world has quietly been setting while you weren't looking.
      </p>

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

      {tab === "records" && <RecordsTab />}
      {tab === "bios" && <BiosTab />}
      {tab === "clubs" && <ClubsTab />}
    </div>
  );
}
