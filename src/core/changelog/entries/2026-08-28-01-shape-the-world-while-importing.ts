import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-28",
  title: "Shape the world while you're importing a roster file",
  items: [
    "Importing a roster file locked you into the eight countries the game ships. World setup, the panel where you switch countries off and add your own, was hidden on that screen, which is the screen you're most likely to want it on: a file covering a league the game hasn't got had nowhere to land. It's there now, on both ways in.",
    "It was hidden for a real reason and I've fixed the reason rather than worked around it. The screen was holding your file's clubs already matched up to team slots, so changing the world underneath them left them aimed at the wrong clubs. It keeps only the files now and works the matching out again against the world as it stands. Reshape the world and the number of clubs your file covers moves with it.",
    "Leagues can be renamed. Hit **Rename** next to any country in World setup and you get boxes for its two division names, and a league you add has the same pair. Leave one empty and it goes back to following the country's name.",
    "That's what makes a stuck file work. A roster file names the competition it fills and finds it **by that name**, so a file written for the Eredivisie filled nothing at all: no league in the game was called the Eredivisie, and there was no way to make one. Rename a league to match your file, or add a league and name it, and the file lands.",
    "The import screen names which of your file's leagues it couldn't place, and World setup sits directly underneath it.",
    "If two divisions end up with the same name, the panel says so. A file aimed at that name can only fill one of them.",
    "Roster files load from the plain New League screen too, under a **Load roster files** button. Both ways in do the same things now, they just start you somewhere different.",
    "If you've already picked your club and then change the world in a way that moves clubs between slots, the pick clears and you choose again. Renaming a league, or retuning one, leaves it alone.",
  ],
};

export default entry;
