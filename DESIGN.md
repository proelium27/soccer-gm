---
name: Soccer GM
description: A club-management sim front office, built for a long dynasty save, not a first-impression screenshot.
---

# Design System: Soccer GM

**This system is implemented.** The tokens below are transcribed from
`src/ui/styles.css`, which is the source of truth — it authors every value as a
CSS custom property and routes Bootstrap's own `--bs-*` variables through them,
so stock components inherit the system rather than fighting it. If a value here
disagrees with that file, the file is right; fix this document.

The app is **dark-only**. There is no light theme and none is planned; the
palette is built on green-tinted dark neutrals and a light variant would be a
second system, not a toggle.

## 1. Overview

**Creative North Star: "The Front Office Terminal"**

Soccer GM is the screen a serious club manager lives in across a 20+ season dynasty: standings, roster, transfers, finances, checked in short bursts, over and over, for months. The system takes cues from Basketball GM and Football Manager's data-first seriousness and ESPN's broadcast-scoreboard confidence in presenting stats at a glance, filtered through a deep pitch-green accent that ties to soccer without ever being literal or decorative about it.

This system explicitly rejects the generic AI/SaaS look (purple gradients, glassmorphism, hero-metric cards, cream-and-black startup templates) and mobile-game/gacha gamification (loud gradients, badges, stat-boost flourish). It also replaced the stock Bootstrap look the app originally shipped with, which was a default rather than a choice — Bootstrap is still the component layer, but every color, face and surface it draws now comes from these tokens.

**Key Characteristics:**
- Committed color: pitch green carries real surface area, not a token 10% accent.
- Data density over whitespace; tables and dense stat views are the primary content, not a departure from it.
- Sharp, technical, geometric sans throughout; no serif, no display flourish.
- Responsive motion only: state changes get clear feedback, nothing is choreographed or orchestrated.

## 2. Colors

Color strategy: **Committed**. The pitch-green accent carries real surface area — the top bar is a deep green band, the sidebar a green-tinted surface, and active nav and primary actions are green. Authored in OKLCH, all on hue ~152–155 so the neutrals and the accent are the same family rather than a gray page with a green sticker on it.

### Primary — pitch green
| Token | Value | Use |
|---|---|---|
| `--sg-green` | `oklch(0.68 0.14 152)` | primary action, active state |
| `--sg-green-hover` | `oklch(0.74 0.15 152)` | hover |
| `--sg-green-active` | `oklch(0.61 0.13 152)` | pressed |
| `--sg-green-bright` | `oklch(0.80 0.15 150)` | links, active nav text |
| `--sg-green-deep` | `oklch(0.335 0.055 155)` | top bar band |
| `--sg-green-deep-2` | `oklch(0.275 0.05 155)` | sidebar surface |
| `--sg-green-wash` | `oklch(0.68 0.14 152 / 0.14)` | tinted row/zone fills |
| `--sg-on-green` | `oklch(0.18 0.03 155)` | ink over green fills (AA contrast) |

### Neutral — green-tinted, hue 155, never `#000`/`#fff`
| Token | Value | Use |
|---|---|---|
| `--sg-bg` | `oklch(0.165 0.012 155)` | page background |
| `--sg-surface` | `oklch(0.205 0.014 155)` | cards, tables |
| `--sg-surface-2` | `oklch(0.245 0.016 155)` | raised/header rows |
| `--sg-border` | `oklch(0.305 0.013 155)` | dividers |
| `--sg-border-strong` | `oklch(0.38 0.015 155)` | emphasized rules |
| `--sg-text` | `oklch(0.94 0.007 155)` | body |
| `--sg-text-muted` | `oklch(0.70 0.011 155)` | secondary |
| `--sg-text-faint` | `oklch(0.58 0.010 155)` | tertiary |

### Semantic
`--sg-win` / `--sg-loss` / `--sg-draw` / `--sg-warn`, each with a `-wash` variant for row fills. Two accents sit deliberately outside the win/loss pair so they can never be misread as a result: `--sg-user` (blue, "this is your club") and `--sg-cup` (teal, Continental Cup qualification zone and bracket).

### Named Rules
**The Signal Rule.** Color-coded rows and deltas (win/loss/draw, rating changes, hype tiers) must never be the only signal; pair every color cue with an icon, sign, or label so it survives grayscale and color-vision-deficient viewing (WCAG AA, per PRODUCT.md). This is also why the your-club highlight is blue and the cup zone teal — a fourth and fifth green would collapse into the win color.

## 3. Typography

**One family everywhere: IBM Plex.** `--sg-font-sans` is IBM Plex Sans (chrome, body, tables); `--sg-font-mono` is IBM Plex Mono, reserved for headline numerals (`.stat-num`, the sim ticker score). No serif, no display face; precision comes from scale and weight contrast, not ornament.

**Scale** — fixed rem steps at roughly a 1.2 ratio. App UI wants spatial predictability, not fluid headings.

| Token | Size | Tier |
|---|---|---|
| `--sg-text-xl` | 1.8rem | display: scores, standings position |
| `--sg-text-lg` | 1.35rem | page titles (`h4`, bold) |
| `--sg-text-md` | 1.05rem | section titles (`h5`) |
| `--sg-text-base` | 0.9375rem (15px) | body, table cells |
| `--sg-text-sm` | 0.82rem | dense secondary text |
| `--sg-text-xs` | 0.72rem | labels, column headers (`h6`: uppercase, tracked, muted) |

Weights: 400 / 500 / 600 / 700 (`--sg-weight-*`). Headings are semibold with `-0.01em` tracking.

### Named Rules
**The Tabular Rule.** Any numeric column uses `font-variant-numeric: tabular-nums` so digits align vertically; this is a data tool first, and misaligned numbers read as unfinished. Applied to `.table`, `.stat-num` and `.sim-ticker-score`, and to every bespoke stat surface (charts, box score, pitch field).

## 4. Elevation

**Flat by default.** Depth comes from tonal layering — `--sg-bg` → `--sg-surface` → `--sg-surface-2` — plus `--sg-border`, not from drop shadows. Cards explicitly carry no shadow. `--sg-shadow` exists for the few genuinely floating elements (modals, popovers). Corner radius is a single `--sg-radius` (6px).

Note that most row highlighting is done with `inset 0 0 0 9999px <wash>` box-shadows rather than `background-color`, because Bootstrap's table striping already owns the background and an inset shadow layers over it cleanly — several highlights can then stack (a wash plus a left edge marker) in one declaration.

## 5. Components

Componentry is Bootstrap 5 with every token overridden, plus bespoke CSS for the surfaces Bootstrap has no answer for. The bespoke blocks in `styles.css`, each with its own commented section: announcement banner, top bar, sidebar, tables, list-group pickers, cards, buttons, transfer-value chart, OVR history chart, division badge, award pills, pitch field (Starting XI), and the box score (scoreboard → head-to-head strip → team tables → play-by-play timeline).

**No emoji anywhere in the UI.** Icons are hand-written inline SVG — see `src/ui/components/AwardIcons.tsx` for the house style.

## 6. Do's and Don'ts

### Do:
- **Do** let the pitch-green accent carry real surface area (nav, primary actions, active states) per the Committed color strategy; a token sliver of color would undersell "sharp/confident."
- **Do** use tabular figures and consistent column alignment in every data table; this is a spreadsheet-adjacent tool used across long sessions.
- **Do** pair every color-coded signal (win/loss, rating delta, hype tier) with a non-color cue (icon, sign, label) per the Signal Rule.
- **Do** add new colors as tokens in `:root` rather than literals at the call site, and keep them on the established hue family.
- **Do** keep motion to clear, responsive feedback on state changes (sim results, roster updates); nothing choreographed.

### Don't:
- **Don't** use purple gradients, glassmorphism, hero-metric cards, or cream-and-black "AI startup" styling.
- **Don't** use loud gradients, badges, or gamified stat-boost visuals (the mobile-game/gacha anti-reference).
- **Don't** reach for Bootstrap's stock blue/gray or a raw hex; both bypass the system.
- **Don't** introduce a fifth or sixth green — the win/qualification/user distinctions already carry the load, and another one collapses them.
- **Don't** sacrifice table density for SaaS-style whitespace; this system is closer to Basketball GM/Football Manager/a broadcast scoreboard than to Linear/Notion/Stripe.
- **Don't** orchestrate animated sequences or transitions beyond direct state-change feedback.
