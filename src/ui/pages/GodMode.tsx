import { useLeague } from "../context/LeagueContext.js";

export function GodMode() {
  const { league } = useLeague();
  if (!league || !league.godMode) return null;
  return (
    <div className="container-fluid py-3">
      <h1 className="h4 mb-3">God Mode</h1>
      <p className="text-secondary">Sandbox tools coming in the next task.</p>
    </div>
  );
}
