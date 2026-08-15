import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-11",
  title: "Retired players are clickable and have a career page",
  items: [
    "A retired player used to be a dead end. His name showed up on the all-time lists with a \"Retired\" tag next to it and nothing to click, and everywhere else that pointed at him by name, an old transfer, a news item, a club's honours board, he showed up as \"Player 4821\" or as a blank space. Retired names now link to a career page like anyone else's.",
    "The page shows what the game kept when he retired: the season he hung up his boots and the age he did it at, his peak rating and the season he hit it in, the clubs he played for, his career totals in every stat with his best single season in each alongside them, every trophy and individual award he won, his transfer history, his international caps and goals, and a season-by-season line with the club and rating for each year plus the rating chart that goes with it.",
    "It shows less than a current player's profile, and deliberately so. Retirement keeps a career record rather than a full match-by-match history, so there are no attribute ratings and no per-season goals and assists behind those career totals. The seasons list shows appearances, and an appearance count of zero means he was in the squad that year without getting on the pitch.",
    "The awards pages benefit most. A Player of the Season or Team of the Season from ten years ago used to empty out as its winners retired, one blank slot at a time. Those boards now name the winners for good.",
    "Only players the game kept a record for get a page. Around 660 players retire per offseason once unsigned players are counted, so the record covers those who either reached a high rating or played a long career. Anyone else still shows as a name without a link. On an existing save the record starts from the offseason it began being kept, so players who retired before then are not recoverable.",
  ],
};

export default entry;
