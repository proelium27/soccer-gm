import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-10",
  title: "The box score page has been rebuilt",
  items: [
    "The two team stat tables no longer sit side by side. Each one is nineteen columns wide, so at half the width of the page the columns overflowed: names wrapped onto three lines and the match rating, the last column, was cut off the right edge of the away side entirely. The tables now run full width, stacked one above the other, and every column fits. The columns are also grouped under attacking, keeping, defending, passing and discipline headings, so nineteen numbers read as five blocks rather than one wall.",
    "The top of the page is now a scoreboard: the competition and matchday, both clubs with their crests, and the score at display size, with the losing side's name and score in a lighter weight so the result is readable at a glance. Under it, a head-to-head strip compares the sides on possession, shots, shots on target, xG, corners and fouls as bars that grow out from the middle, replacing the three lines of small text that carried possession and xG before.",
    "The play-by-play is now a timeline. Events run down a centre line with the clock on it, one club's events to the left and the other's to the right, and goals, cards, substitutions and injuries carry their own marks and colours. It also opens filtered to the events that decided the match: goals, cards, substitutions, penalties and injuries. A full match generates around thirty events, most of them shots that went nowhere, which buried the handful that mattered. \"Every event\" switches the shots and corners back on.",
    "Man of the Match was previously marked with a pale yellow band that came from the underlying stylesheet rather than the game's own palette and read as a rendering fault on the dark page. He is now marked in the game's own gold, with a star on his row.",
  ],
};

export default entry;
