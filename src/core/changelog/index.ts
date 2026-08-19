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
 * - Write INFORMALLY AND PERSONALLY: first person is wanted, and own the cause
 *   when there was one ("as the world grew bigger I never expanded the name pool
 *   with it") rather than reporting it from nowhere ("the pools have been
 *   expanded"). Informal means *plain*, not *performative* — no jokes, no
 *   winking asides, no hype. Lead with the concrete thing a player would have
 *   noticed, then the numbers, and give both together: "twelve separate men
 *   called Ahmet Ozturk" lands where "17.7% duplicate rate" alone doesn't.
 *   Still specific and honest — informal replaces the tone, not the substance,
 *   and a known limitation is stated plainly rather than apologised for.
 * - NEVER open with a narrative hook (2026-08-18, user call). No scene-setting,
 *   no "someone told me...", no build-up to a reveal. Open on the mechanic or
 *   the symptom itself and let the reader get the point from sentence one. The
 *   same goes mid-entry: state the next point rather than announcing it
 *   ("There was a second half to it", "One thing to know" — cut both, just say
 *   the thing). Informal is about register, never about storytelling.
 *   (This voice was set 2026-08-15 and REVERSED a 2026-08-05 "purely
 *   informational, no first person" rule, which had itself reversed a
 *   2026-07-20 casual-voice one. Voice has flipped twice, so entries are in
 *   whichever voice was live when they shipped and were never rewritten —
 *   match the NEWEST entries, not older ones, and update this comment in the
 *   same PR if it ever flips again.)
 * - Group a batch of related changes shipped together into one entry file.
 * - Formatting: entries are **markdown** (GFM) as of 2026-08-16. Each `items`
 *   string is one block and they are joined with a blank line, so the old
 *   one-string-per-paragraph entries render exactly as before. Within a string
 *   use whatever the entry actually calls for — `-` lists, `**bold**`,
 *   `` `code` ``, tables — and mix lists with prose in the same entry rather
 *   than writing four paragraphs in a row because that was once the only
 *   option. Prose still carries the argument; a list is for things that are
 *   genuinely a list (per-position numbers, several independent changes).
 *   Raw HTML is not rendered, so angle brackets in prose are safe.
 *   The legacy `list: true` flag (all items become bullets) is kept working for
 *   the three entries that predate markdown; don't use it in new entries.
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
