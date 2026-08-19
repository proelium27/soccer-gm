import { lazy, Suspense } from "react";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { LeagueProvider } from "./context/LeagueContext.js";
import { SportNameProvider, useSportName } from "./sportName.js";
import { useRouteSeo } from "./seo.js";
import { Layout } from "./components/Layout.js";
import { AnnouncementBanner } from "./components/AnnouncementBanner.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { Leagues } from "./pages/Leagues.js";
import { NewLeague } from "./pages/NewLeague.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Standings } from "./pages/Standings.js";
import { Cup } from "./pages/Cup.js";
import { DomesticCup } from "./pages/DomesticCup.js";
import { NTWorldCup } from "./pages/nationalTeams/WorldCup.js";
import { NTQualifying } from "./pages/nationalTeams/Qualifying.js";
import { NTSchedule } from "./pages/nationalTeams/Schedule.js";
import { NTRosters } from "./pages/nationalTeams/Rosters.js";
import { NTPowerRankings } from "./pages/nationalTeams/PowerRankings.js";
import { NTStatLeaders } from "./pages/nationalTeams/StatLeaders.js";
import { NTHistory } from "./pages/nationalTeams/History.js";
import { Frivolities } from "./pages/Frivolities.js";
import { PowerRankings } from "./pages/PowerRankings.js";
import { Schedule } from "./pages/Schedule.js";
import { Roster } from "./pages/Roster.js";
import { Leaders } from "./pages/Leaders.js";
import { BoxScore } from "./pages/BoxScore.js";
import { IncomingTalent } from "./pages/IncomingTalent.js";
import { FreeAgents } from "./pages/FreeAgents.js";
import { Academy } from "./pages/Academy.js";
import { Transfers } from "./pages/Transfers.js";
import { IncomingOffers } from "./pages/IncomingOffers.js";
import { Loans } from "./pages/Loans.js";
import { Finance } from "./pages/Finance.js";
import { GodMode } from "./pages/GodMode.js";
import { NewsFeed } from "./pages/NewsFeed.js";
import { Awards } from "./pages/Awards.js";
import { ClubHistory } from "./pages/ClubHistory.js";
import { SeasonPreview } from "./pages/SeasonPreview.js";
import { SetScouting } from "./pages/SetScouting.js";
import { Manual } from "./pages/Manual.js";
/**
 * The one lazily-loaded route. Changelog entries are markdown, and
 * react-markdown plus remark-gfm is ~158 kB raw / ~48 kB gzipped — a real cost
 * to put in front of every player for a page most open once, if ever. Split
 * out, it is fetched only when someone actually opens /changelog.
 *
 * Nothing else here is lazy: the rest of the app shares the same handful of
 * dependencies, so splitting those routes would trade one download for many
 * without shrinking the total.
 */
const Changelog = lazy(() =>
  import("./pages/Changelog.js").then((m) => ({ default: m.Changelog })),
);
import { PlayerProfile } from "./pages/PlayerProfile.js";

function RootRedirect() {
  return <Navigate to="/leagues" replace />;
}

/**
 * Keeps <head> (title, description, canonical, robots) in step with the route.
 * Renders nothing — it exists purely for the effect, and has to sit inside both
 * the router and the sport-name provider to read either one.
 */
function RouteSeo() {
  const { brand } = useSportName();
  useRouteSeo(brand);
  return null;
}

// itch.io and CrazyGames both serve the game from a deep subpath inside an
// iframe with no server to handle history-API deep links, so those builds swap
// to hash-based routes (/#/roster). Every other target keeps clean URLs. Driven
// by the build mode (see .env.itch / .env.crazygames / vite.config.ts).
const crazyGames = import.meta.env.VITE_BUILD_TARGET === "crazygames";
const embedded = import.meta.env.VITE_BUILD_TARGET === "itch" || crazyGames;
const Router = embedded ? HashRouter : BrowserRouter;

// The CrazyGames build strips the SEO block from index.html, so it must not run
// the runtime half either — useRouteSeo would recreate the canonical tag, which
// points at worldsoccersim.org, a playable copy of this same game. Their rules
// don't allow linking one from the other.
const seoEnabled = !crazyGames;

// The announcement banner is dropped from the CrazyGames build for two reasons
// that happen to agree. Space: their container is a fixed 16:9 box as small as
// 914x514, where the strip costs 36px of 514 — 7% of the height, on every
// screen, permanently for anyone who doesn't dismiss it. Rules: it is a
// full-width bar whose action is "Join the Discord", and community links are
// allowed on a game menu only so long as they aren't a main CTA. The same link
// still sits in the sidebar, which is squarely within what they allow.
const announcementEnabled = !crazyGames;

export function App() {
  return (
    <Router>
      <SportNameProvider>
      {seoEnabled && <RouteSeo />}
      <LeagueProvider>
        {announcementEnabled && <AnnouncementBanner />}
        {/* Outer net for the routes that render outside Layout (the league
            picker and new-league flow), which have no boundary of their own.
            Pages inside Layout get a per-route boundary that keeps the nav
            alive, so this one only catches what that can't reach. */}
        <ErrorBoundary what="the game">
        <Routes>
          <Route path="/leagues" element={<Leagues />} />
          <Route path="/new-league" element={<NewLeague />} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/standings" element={<Standings />} />
            <Route path="/cup" element={<Cup />} />
            <Route path="/domestic-cup" element={<DomesticCup />} />
            <Route path="/national-teams/world-cup" element={<NTWorldCup />} />
            <Route path="/national-teams/qualifying" element={<NTQualifying />} />
            <Route path="/national-teams/schedule" element={<NTSchedule />} />
            <Route path="/national-teams/rosters" element={<NTRosters />} />
            <Route path="/national-teams/power-rankings" element={<NTPowerRankings />} />
            <Route path="/national-teams/leaders" element={<NTStatLeaders />} />
            <Route path="/national-teams/history" element={<NTHistory />} />
            {/* Old single International page → the World Cup tab of the new section. */}
            <Route path="/international" element={<Navigate to="/national-teams/world-cup" replace />} />
            <Route path="/power-rankings" element={<PowerRankings />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/news" element={<NewsFeed />} />
            <Route path="/awards" element={<Awards />} />
            <Route path="/history" element={<ClubHistory />} />
            <Route path="/frivolities" element={<Frivolities />} />
            <Route path="/season-preview" element={<SeasonPreview />} />
            <Route path="/set-scouting" element={<SetScouting />} />
            <Route path="/box-score/:matchIndex" element={<BoxScore />} />
            <Route path="/roster" element={<Roster />} />
            <Route path="/leaders" element={<Leaders />} />
            <Route path="/incoming-talent" element={<IncomingTalent />} />
            <Route path="/free-agents" element={<FreeAgents />} />
            <Route path="/academy" element={<Academy />} />
            <Route path="/transfers" element={<Transfers />} />
            <Route path="/incoming-offers" element={<IncomingOffers />} />
            <Route path="/loans" element={<Loans />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/god-mode" element={<GodMode />} />
            <Route path="/player/:pid" element={<PlayerProfile />} />
          </Route>
          {/* The manual and the changelog are plain reading material — they
              don't touch league state, so they render with or without a save
              loaded. That matters beyond convenience: they're the only pages a
              search engine (or anyone following a shared link) can actually
              read, and behind the normal Layout gate they just bounced to the
              league picker. */}
          <Route element={<Layout allowNoLeague />}>
            <Route path="/manual" element={<Manual />} />
            <Route
              path="/changelog"
              element={
                // Falls back to the page's own heading rather than a spinner,
                // so the chunk arriving reads as the list filling in rather
                // than the page replacing itself.
                <Suspense fallback={<div className="container-fluid p-3"><h1 className="h4">Changelog</h1></div>}>
                  <Changelog />
                </Suspense>
              }
            />
          </Route>
          <Route path="*" element={<RootRedirect />} />
        </Routes>
        </ErrorBoundary>
      </LeagueProvider>
      </SportNameProvider>
    </Router>
  );
}
