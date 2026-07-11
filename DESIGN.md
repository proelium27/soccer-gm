<!-- SEED: re-run $impeccable document once the redesign has real code to capture actual tokens and components. -->

---
name: Soccer GM
description: A club-management sim front office, built for a long dynasty save, not a first-impression screenshot.
---

# Design System: Soccer GM

## 1. Overview

**Creative North Star: "The Front Office Terminal"**

Soccer GM is the screen a serious club manager lives in across a 20+ season dynasty: standings, roster, transfers, finances, checked in short bursts, over and over, for months. The system takes cues from Basketball GM and Football Manager's data-first seriousness and ESPN's broadcast-scoreboard confidence in presenting stats at a glance, filtered through a deep pitch-green accent that ties to soccer without ever being literal or decorative about it.

This system explicitly rejects the generic AI/SaaS look (purple gradients, glassmorphism, hero-metric cards, cream-and-black startup templates), mobile-game/gacha gamification (loud gradients, badges, stat-boost flourish), and the plain Bootstrap-default look the app ships with today, since that palette and componentry were never a deliberate choice.

**Key Characteristics:**
- Committed color: pitch green carries real surface area, not a token 10% accent.
- Data density over whitespace; tables and dense stat views are the primary content, not a departure from it.
- Sharp, technical, geometric sans throughout; no serif, no display flourish.
- Responsive motion only: state changes get clear feedback, nothing is choreographed or orchestrated.

## 2. Colors

`[to be resolved during implementation]`

Color strategy: **Committed**. The pitch-green accent is expected to carry roughly 30-60% of surface area (primary nav, key actions, active states), not restrained to a sliver of the UI. Anchor hue: a deep, desaturated pitch/turf green, dark enough to read as authoritative rather than playful.

### Primary
- **Deep Pitch Green** (`[hex/oklch to be resolved]`): primary actions, active navigation, key highlights. Carries real surface area under the Committed strategy, not a token accent.

### Neutral
- **[to be named]**: page background, tinted toward the green hue at low chroma rather than a flat gray.
- **[to be named]**: card/table surface, one step lighter or darker than background depending on final light/dark decision.
- **[to be named]**: body text.
- **[to be named]**: borders/dividers, low-contrast against surface.

### Named Rules (optional, powerful)
**The Signal Rule.** Color-coded rows and deltas (win/loss/draw, rating changes, hype tiers) must never be the only signal; pair every color cue with an icon, sign, or label so it survives grayscale and color-vision-deficient viewing (WCAG AA, per PRODUCT.md).

## 3. Typography

**Display Font:** `[single technical/geometric sans, family to be chosen at implementation]`
**Body Font:** same family as Display (single-family system)
**Label/Mono Font:** `[to be resolved; a tabular-figures variant of the same sans, or a companion mono for stat columns, to be decided at implementation]`

**Character:** One clean, technical, geometric sans used everywhere, chrome and data tables alike. No serif, no display flourish; precision comes from scale and weight contrast, not ornament.

### Hierarchy
- **Display** (`[weight/size TBD]`): season/match headline numbers (final scores, standings position).
- **Headline** (`[weight/size TBD]`): page titles (Roster, Standings, Transfers).
- **Title** (`[weight/size TBD]`): section headers within a page.
- **Body** (`[weight/size TBD]`): table cells, player names, stat values. Must stay legible at high density; this is the most-used tier in the system.
- **Label** (`[weight/size TBD]`): column headers, tags, badges.

### Named Rules (optional)
**The Tabular Rule.** Any numeric column (stats, ratings, standings) uses tabular figures so digits align vertically; this is a data tool first, and misaligned numbers read as unfinished.

## 4. Elevation

`[to be resolved during implementation]` — inferred from Responsive motion energy: flat by default. Depth, if any, should come from tonal layering (a slightly different neutral for cards/tables against the page background) rather than drop shadows, consistent with a dense, no-frills front-office tool rather than a soft consumer-app feel.

## 5. Components

`[components to be resolved once implementation begins; this seed intentionally omits invented components]`

## 6. Do's and Don'ts

### Do:
- **Do** let the pitch-green accent carry real surface area (nav, primary actions, active states) per the Committed color strategy; a token sliver of color would undersell "sharp/confident."
- **Do** use tabular figures and consistent column alignment in every data table; this is a spreadsheet-adjacent tool used across long sessions.
- **Do** pair every color-coded signal (win/loss, rating delta, hype tier) with a non-color cue (icon, sign, label) per the Signal Rule.
- **Do** keep motion to clear, responsive feedback on state changes (sim results, roster updates); nothing choreographed.

### Don't:
- **Don't** use purple gradients, glassmorphism, hero-metric cards, or cream-and-black "AI startup" styling.
- **Don't** use loud gradients, badges, or gamified stat-boost visuals (the mobile-game/gacha anti-reference).
- **Don't** carry over the current Bootstrap-default blue/gray palette or componentry; it was never a deliberate choice.
- **Don't** sacrifice table density for SaaS-style whitespace; this system is closer to Basketball GM/Football Manager/a broadcast scoreboard than to Linear/Notion/Stripe.
- **Don't** orchestrate animated sequences or transitions beyond direct state-change feedback.
