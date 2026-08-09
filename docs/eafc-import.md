# Importing EA FC rosters

Turns an EA FC player CSV into a soccer-gm roster file, so you can play a
season with real clubs and real players instead of the generated fictional
world.

Nothing here ships. The converter is a dev script, the CSV and the roster file
it produces are gitignored, and the game continues to ship its own 240
fictional clubs — real names and ratings are a local overlay you bring
yourself, loaded through the roster import that already exists on the Leagues
page.

## Workflow

1. Get an EA FC player dataset as CSV — the sofifa-derived "complete player
   dataset" exports work directly. You want the version with the *detailed*
   attribute columns (`attacking_short_passing`, `defending_standing_tackle`,
   `movement_sprint_speed`, `goalkeeping_*`), not just the six face stats;
   without them every player's skills get flattened onto pace/shooting/passing
   and imported squads lose their individuality.

2. Convert:

   ```bash
   npx tsx scripts/eafcRosterConvert.ts --in players_25.csv --out eafc-roster.json
   ```

   Run it with `--help` for the full flag list. It prints what it kept, what it
   skipped, and the EA→soccer-gm overall mapping per league, so you can see
   what it did before loading anything.

3. In-game: **Leagues → Import roster file →** pick `eafc-roster.json`.

Import replaces each listed club's identity *and* squad, and tops any short
position up with deliberately-weak filler so every squad is legal. Slots the
file doesn't cover keep their existing fictional club untouched — so a partial
import is fine.

## What the converter has to reconcile

**Rating scale.** This is the part that matters most. A freshly generated
soccer-gm world spans roughly 23–81 OVR (tier-1 median 62, 95th percentile 73,
maximum 81); 90+ only ever appears after decades of progression, by design. EA
FC's top flights run 47–91 with a couple of dozen players at 88+. Importing EA
numbers verbatim would lift the whole world about ten points, which collides
with the anti-inflation equilibrium the sim is tuned around — wages are cubic
in OVR, the elite valuation premium keys off 76, the division-2 ceiling off 70.

So overalls are **rank-matched** rather than fitted to a hand-tuned curve: a
player at the Nth percentile of the imported set is assigned the OVR at the Nth
percentile of a freshly generated reference world. The imported world therefore
has the same OVR distribution as a generated one, with no tuned constants to
drift. The practical consequence is that the best player in the world reads
about 86 rather than 91 — the ordering and the gaps are faithful, the absolute
numbers are on soccer-gm's scale.

`--scale` picks how leagues are matched:

- `competition` (default) rank-matches each league onto its own soccer-gm
  counterpart. This preserves the game's designed country-strength gaps (France
  and Portugal are deliberately weaker — see `COUNTRY_STRENGTH_OFFSET`) and
  keeps second-tier stars below the division-2 ceiling.
- `global` pools all twelve leagues, so real cross-league gaps carry over
  instead. More faithful to reality, but the strongest second-tier players can
  then clear the division-2 ceiling (70) and get swept up to a top flight in
  the first offseason by `enforceDivision2Ceiling`.

**Attributes.** The two sets line up unusually well — both are 1–99, and 12 of
soccer-gm's 14 skills have a near-namesake in EA's list. Two judgment calls:
`tackling` averages EA's standing and sliding tackle, and `positioning` (which
soccer-gm weights for *every* position, so it means general game-reading) is
blended per-position from EA's attacking `mentality_positioning` and defensive
`defending_marking_awareness`, using `goalkeeping_positioning` for keepers.

Each player's attributes give his rating *shape*; the shape is then shifted
uniformly until it computes to his rescaled overall. That is what keeps a fast
winger fast and a strong one strong while still landing every player on the
right number.

**Positions.** EA's 27 slot labels collapse onto soccer-gm's 8 roles. The lossy
one is width: LM/RM and LW/RW all become `W`, since there is no wide-midfield
role and `W` is the closer fit for both.

**Leagues and clubs.** Only the twelve competitions the game models are kept;
everything else in the dataset is skipped and reported. Each league's clubs are
ranked by squad strength and the top 20 take the game's 20 slots — leagues with
18 real clubs (Bundesliga, Ligue 1, Primeira Liga) leave two fictional clubs in
place, and leagues with more (the Championship's 24) drop the weakest. Squads
are picked to match `ROSTER_COMPOSITION` rather than taking a flat top 25, so
nobody ends up with one keeper and seven strikers.

**Club colors and abbreviations** aren't in the datasets, so both are
synthesized deterministically from the club name. Override the ones you care
about with `--identities`:

```json
{
  "Manchester City": { "abbrev": "MCI", "colors": ["#6CABDD", "#ffffff"] },
  "FC Barcelona":    { "abbrev": "BAR", "colors": ["#A50044", "#004D98"] }
}
```

## Known gap: club strength anchors are not realigned

Each club slot carries an `academyBase` — a fixed generation-time strength
anchor that drives its youth intake for the rest of the save — and generation
*shuffles* those anchors, so slot order has nothing to do with slot strength.
Import overwrites a club's identity and squad but not its anchor, so a
superclub can land on a slot anchored 18 points below the league's strongest
and drift down over a long save.

This predates the EA FC converter (it applies to any hand-authored roster file)
and fixing it means a change in `applyRosterFile` — permuting each
competition's existing anchors so the strongest imported squad gets the
strongest anchor. That is zero-sum by construction (same multiset of values,
just reassigned, applied once rather than derived per-season), so it cannot
reopen the inflation ratchet, but it changes shared engine behaviour for the
existing roster-import feature too and hasn't been made yet.

For a short save it doesn't bite. For a long dynasty, expect imported clubs'
academies to drift toward their slot's anchor rather than their reputation.

## Layout

| Path | What |
| --- | --- |
| `scripts/eafcRosterConvert.ts` | CLI entry point |
| `scripts/eafc/csv.ts` | RFC 4180 reader (no dependency) |
| `scripts/eafc/schema.ts` | column detection across dataset naming conventions |
| `scripts/eafc/positions.ts` | EA position → soccer-gm position |
| `scripts/eafc/leagues.ts` | EA league name → competition |
| `scripts/eafc/nations.ts` | EA nation name → nationality key |
| `scripts/eafc/ratings.ts` | EA attributes → `PlayerRatings`, shift-to-overall |
| `scripts/eafc/scale.ts` | rank-matching rescale |
| `scripts/eafc/identity.ts` | abbrevs and colors |
| `scripts/eafc/convert.ts` | the pipeline |
| `scripts/ovrDistProbe.ts` | prints the world's OVR distribution (calibration) |
| `test/core/eafcConvert.test.ts` | tests, incl. a round-trip through the real importer |
