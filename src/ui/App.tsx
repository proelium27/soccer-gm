import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LeagueProvider, useLeague } from "./context/LeagueContext.js";
import { Layout } from "./components/Layout.js";
import { NewLeague } from "./pages/NewLeague.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Standings } from "./pages/Standings.js";
import { Schedule } from "./pages/Schedule.js";
import { Roster } from "./pages/Roster.js";
import { Leaders } from "./pages/Leaders.js";
import { BoxScore } from "./pages/BoxScore.js";
import "./styles.css";

function RootRedirect() {
  const { league } = useLeague();
  return <Navigate to={league ? "/dashboard" : "/new-league"} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <LeagueProvider>
        <Routes>
          <Route path="/new-league" element={<NewLeague />} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/standings" element={<Standings />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/box-score/:matchIndex" element={<BoxScore />} />
            <Route path="/roster" element={<Roster />} />
            <Route path="/leaders" element={<Leaders />} />
          </Route>
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </LeagueProvider>
    </BrowserRouter>
  );
}
