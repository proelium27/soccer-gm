# Product

## Register

product

## Users

A solo player running their own club across many seasons: checking standings, managing the roster, making transfer/lineup decisions, then sitting back to sim ahead. Sessions are frequent and short (check in, adjust, sim, repeat) across a single long-running save. The primary job on any given screen is fast situational awareness (where do things stand) followed by a quick decision (who to sign, who to start, whether to sim ahead).

## Product Purpose

A browser-based, client-side, BBGM-style soccer management sim. It exists to deliver a playable dynasty loop (matches, table, transfers, youth development, finances) without the licensing weight or bloat of commercial management sims. Success looks like a tool the user trusts enough to run a 20+ season save in, the way people run decade-long saves in Basketball GM or Football Manager.

## Brand Personality

Authoritative and expert-grade: a serious front-office tool, not a toy. Sharp and confident: modern, precise, a bit stylish without being flashy. The current implementation (plain Bootstrap 5 defaults) already lands somewhat authoritative/functional by virtue of dense tables and no-nonsense layout, but reads as generic rather than sharp or confident. That gap, sharp/confident, is the primary thing the visual redesign needs to close.

## Anti-references

- Generic AI/SaaS look: purple gradients, glassmorphism, hero-metric cards, cream-and-black "AI startup" templates.
- Mobile game / gacha UI: loud gradients, badges, gamified stat-boost visuals.
- Bootstrap-default look: today's out-of-the-box Bootstrap blue/gray palette and componentry, since that's what's there by default rather than by choice.

## Design Principles

- Data density over whitespace: this is a spreadsheet-adjacent tool used across long sessions; don't sacrifice scannable tables and dense stat views for airy SaaS-style spacing.
- Reference the sim-management lane, not the SaaS lane: Basketball GM / Football Manager are the north star, not Linear/Notion/Stripe.
- Earn "sharp/confident" through restraint and precision, not decoration: a committed but disciplined palette and strong typographic hierarchy, not gradients or flourish.
- Color carries information first, decoration second: standings/stat color-coding (win/loss, rating deltas, hype tiers) must stay legible and never be the only signal.
- Built for the long save: choices should hold up and stay legible after 20+ in-fiction seasons of dense data, not just in a first-impression screenshot.

## Accessibility & Inclusion

Standard WCAG AA: solid contrast ratios, full keyboard navigation, and no color-only signaling, relevant since standings/stat tables already lean on color-coded rows (win/loss/draw highlighting, rating deltas) and that pattern must stay accessible as the design system matures.
