import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-19",
  title: "The layout holds up in a narrow window now",
  items: [
    "If you play with the browser window narrower than about 1200 pixels, so half a screen or a small laptop, the top bar was wrapping onto two lines and cutting the season down to \"2026 — Match…\". I found it while fitting the game into a smaller embedded window, but it was never specific to that. It's been like that in any narrow window for as long as those buttons have been up there, and I'd just never played that way.",
    "Below 1200 pixels, Export, Import, Switch League, Copy AI Prompt and God Mode now fold into a **•••** menu next to Sim, the same way they already did on phones. The bar stays on one line and the season label stays whole.",
    "The sidebar narrows from 220 pixels to 170 in that range. Every link is still there, at a smaller size.",
    "That's roughly 70 pixels of width and 20 of height back to the page you're actually reading, which on a short window buys you another row or two of the standings before you have to scroll. If you play maximised on a big monitor, nothing changes.",
  ],
};

export default entry;
