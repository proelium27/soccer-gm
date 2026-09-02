import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-09-02",
  title: "The AI prompt is where you actually need it now",
  items: [
    '"Copy AI Prompt to Customize" is now on the Leagues screen next to Import, and on the New League screen. It used to be in the top bar of a save, which was the wrong place for it: roster files only load while you\'re creating a league, so the one screen that could hand you the prompt was a screen you\'d already left.',
    "The New League one describes the world you're building right then. Add a league, rename one, change a division's size, and the prompt tells the AI about it, so what it writes fits what you're making. The Leagues one describes the default world, which is what most saves are.",
    "The prompt itself was missing something. Every club takes exactly two colors, and one club with three is enough to make the game refuse the whole file. Someone sent me an all-time-teams file, 232 clubs and nearly 6,000 players, that wouldn't load at all, and it came down to two Brazilian clubs listed with their real three colors. Nothing in the prompt said two was a hard limit, so the AI had no reason to treat it as one. It does now, and it's on the checklist at the end.",
    "It also separates the two kinds of mistake, because they behave differently. Get a league's name or its club count wrong and the file imports, it just quietly doesn't do what you meant. Get a field's shape wrong and it doesn't import at all. An AI told that everything degrades gracefully won't stop to check the shapes.",
  ],
};

export default entry;
