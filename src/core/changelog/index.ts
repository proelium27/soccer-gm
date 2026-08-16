/**
 * Player-facing changelog: a hand-maintained, reverse-chronological record of
 * every player-visible change, shown on the /changelog page (sidebar, under
 * Help, next to the Manual).
 *
 * **One entry per file, and nothing here lists them.** Entries live in
 * `entries/` and are discovered by the glob below, so shipping a changelog
 * entry only ever *adds* a file. This is deliberate: the changelog used to be a
 * single `CHANGELOG` array that every PR prepended to, which meant two open PRs
 * always edited the same line and the second one to merge always conflicted.
 * Never reintroduce a central list — an index file that imports each entry
 * would bring the conflict straight back.
 *
 * Adding an entry (same bar as the Manual — see CLAUDE.md):
 * - Create `entries/YYYY-MM-DD-NN-some-slug.ts` in the same PR as the change,
 *   default-exporting one `ChangelogEntry`. Copy the newest existing file for
 *   the shape. `NN` is a two-digit slot within that day, `01` being the newest;
 *   use `01` unless the day already has entries and you want to sit under them.
 * - Write INFORMALLY AND PERSONALLY (user call, 2026-08-15, reversing the
 *   2026-08-05 "purely informational, no first person" rule that this comment
 *   used to carry): first person is wanted, and own the cause when there was
 *   one — "as the world grew bigger I never expanded the name pool with it, so
 *   a bunch of players ended up sharing a name", not "the pools have been
 *   expanded". Lead with the concrete thing a player would have noticed, then
 *   the numbers, and give both together rather than the figure alone.
 *   Informal means PLAIN, not performative: no jokes, no winking asides, no
 *   hype. Still specific and honest with real numbers — the tone changed, the
 *   substance didn't, and a known limitation is stated plainly rather than
 *   apologised for. No em-dashes and no emoji (repo-wide rules).
 *   The voice has flipped twice now, so treat the newest entries as the live
 *   sample; entries written under an older rule were deliberately not
 *   rewritten. The Discord version of a release uses this same voice and only
 *   differs in layout.
 * - Group a batch of related changes shipped together into one entry file.
 * - Formatting: entries render as prose paragraphs (one per `items` string) by
 *   default, which is what most entries should be. Only set `list: true` when
 *   the post genuinely enumerates a bunch of distinct features (e.g. God Mode,
 *   Import Teams); then `items` render as bullets.
 *
 * Ordering is derived, not authored: newest `date` first, and within one date
 * by filename ascending (so the `NN` slot decides). Two PRs that both ship on
 * the same day and both pick `01` don't conflict — they just order by slug.
 */
import type { ChangelogEntry } from "./types.js";

export type { ChangelogEntry };

// Eager so the changelog is plain data at module load (the page maps over it
// synchronously) and so a malformed entry fails the build, not a click.
const modules = import.meta.glob<ChangelogEntry>("./entries/*.ts", {
  eager: true,
  import: "default",
});

/** Newest first. Add a file under `entries/`; this picks it up automatically. */
export const CHANGELOG: ChangelogEntry[] = Object.keys(modules)
  // Filename ascending first, then a stable sort by date descending, so
  // same-day entries keep filename order and the `NN` slot is what orders them.
  .sort()
  .map((path) => modules[path])
  .sort((a, b) => b.date.localeCompare(a.date));
