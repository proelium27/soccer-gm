import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LeagueProvider, useLeague } from "./context/LeagueContext.js";
import { Layout } from "./components/Layout.js";
import { Leagues } from "./pages/Leagues.js";
import { NewLeague } from "./pages/NewLeague.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Standings } from "./pages/Standings.js";
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
import { Finance } from "./pages/Finance.js";
import { NewsFeed } from "./pages/NewsFeed.js";
import { Awards } from "./pages/Awards.js";
import { SeasonPreview } from "./pages/SeasonPreview.js";
import { Manual } from "./pages/Manual.js";
import { PlayerProfile } from "./pages/PlayerProfile.js";

function RootRedirect() {
  const { league, loadingActiveLeague } = useLeague();
  if (loadingActiveLeague) return <p className="p-3">Loading...</p>;
  return <Navigate to={league ? "/dashboard" : "/leagues"} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <LeagueProvider>
        <Routes>
          <Route path="/leagues" element={<Leagues />} />
          <Route path="/new-league" element={<NewLeague />} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/standings" element={<Standings />} />
            <Route path="/power-rankings" element={<PowerRankings />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/news" element={<NewsFeed />} />
            <Route path="/awards" element={<Awards />} />
            <Route path="/season-preview" element={<SeasonPreview />} />
            <Route path="/box-score/:matchIndex" element={<BoxScore />} />
            <Route path="/roster" element={<Roster />} />
            <Route path="/leaders" element={<Leaders />} />
            <Route path="/incoming-talent" element={<IncomingTalent />} />
            <Route path="/free-agents" element={<FreeAgents />} />
            <Route path="/academy" element={<Academy />} />
            <Route path="/transfers" element={<Transfers />} />
            <Route path="/incoming-offers" element={<IncomingOffers />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/manual" element={<Manual />} />
            <Route path="/player/:pid" element={<PlayerProfile />} />
          </Route>
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </LeagueProvider>
    </BrowserRouter>
  );
}
