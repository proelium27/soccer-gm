import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-04",
  title: "Players don't inherit their new club's old league titles anymore",
  items: [
    "Someone spotted that signing a player handed him every league title the club had ever won, including ones from before he was born.",
    "The cause was that nothing anywhere records who was on a roster in a given season, so the profile worked backwards through a player's transfers to guess which club he was at, and for any season before his first move it just assumed he'd always been where he is now. That guess is what was handing out the trophies. It now reads his actual season record at the club instead, which is real data and doesn't need guessing, so a title only shows up if he was genuinely in the squad that won it. Existing saves are corrected too, since this is worked out fresh every time you open a profile rather than stored anywhere.",
    "One rough edge left: a title counts for whichever squad he finished the season in, so a January signing at the eventual champions gets the trophy and someone who left them in January doesn't. Splitting a season between two clubs properly is a bigger job that's on the list.",
  ],
};

export default entry;
