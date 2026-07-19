<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into soccer-gm. The project already had Vercel Web Analytics tracking 8 gameplay events via `src/ui/analytics.ts`. PostHog has been added alongside it — the `trackEvent` helper now calls both `track()` (Vercel) and `posthog.capture()` simultaneously, so no existing coverage is lost and PostHog gains the full event set from day one. Six new events were also added for roster and academy actions that were not previously tracked at all. PostHog is initialized in `src/ui/main.tsx` via environment variables before the React tree mounts, so it is ready for the very first user interaction.

| Event name | Description | File |
|---|---|---|
| `league_created` | User starts a brand-new league save, with `country` and `tier` properties | `src/ui/analytics.ts` + `src/ui/pages/NewLeague.tsx` |
| `season_simmed` | User simulates forward with `through` property (game/month/deadline/season) | `src/ui/analytics.ts` + `src/ui/context/LeagueContext.tsx` |
| `offseason_advanced` | User advances past the offseason into a new season | `src/ui/analytics.ts` + `src/ui/context/LeagueContext.tsx` |
| `transfer_offer_made` | User makes a transfer bid for another club's player | `src/ui/analytics.ts` + `src/ui/context/LeagueContext.tsx` |
| `inbound_offer_accepted` | User accepts an AI club's inbound offer for one of their players | `src/ui/analytics.ts` + `src/ui/context/LeagueContext.tsx` |
| `free_agent_signed` | User signs a free agent to their senior roster | `src/ui/analytics.ts` + `src/ui/context/LeagueContext.tsx` |
| `formation_changed` | User changes their team's tactical formation, with `formation` property | `src/ui/analytics.ts` + `src/ui/context/LeagueContext.tsx` |
| `player_loaned_out` | User lists one of their players for loan with `seasons` property (1/2/3) | `src/ui/analytics.ts` + `src/ui/context/LeagueContext.tsx` |
| `player_released` | User releases a player from their senior roster | `src/ui/context/LeagueContext.tsx` |
| `contract_extended` | User extends a player's contract on their senior roster | `src/ui/context/LeagueContext.tsx` |
| `player_signed_to_academy` | User signs a prospect to their youth academy | `src/ui/context/LeagueContext.tsx` |
| `player_promoted_from_academy` | User promotes an academy player to the senior roster | `src/ui/context/LeagueContext.tsx` |
| `loan_offer_accepted` | User accepts an AI club's loan offer for one of their listed players | `src/ui/context/LeagueContext.tsx` |
| `league_imported` | User imports a save file to restore a previously exported league | `src/ui/pages/NewLeague.tsx` |

## Next steps

We've built a dashboard and five insights for you to keep an eye on player behavior:

- **Dashboard**: [Analytics basics (wizard)](https://us.posthog.com/project/519849/dashboard/1873085)
- **New leagues created**: [https://us.posthog.com/project/519849/insights/VO5LwqXA](https://us.posthog.com/project/519849/insights/VO5LwqXA)
- **Player engagement funnel (create → sim → advance)**: [https://us.posthog.com/project/519849/insights/65hyMgJs](https://us.posthog.com/project/519849/insights/65hyMgJs)
- **Simulation depth by type**: [https://us.posthog.com/project/519849/insights/JkSg4Lmn](https://us.posthog.com/project/519849/insights/JkSg4Lmn)
- **Transfer market activity**: [https://us.posthog.com/project/519849/insights/ReErI7Qz](https://us.posthog.com/project/519849/insights/ReErI7Qz)
- **Roster management actions**: [https://us.posthog.com/project/519849/insights/2xoZ0xUs](https://us.posthog.com/project/519849/insights/2xoZ0xUs)

## Verify before merging

- [ ] Run a full production build (`npm run build`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite (`npm test`) — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` to `.env.example` and any bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or Vite's upload step) into CI so production stack traces de-minify.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
