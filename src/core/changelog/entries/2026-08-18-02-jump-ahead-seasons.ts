import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-08-18",
  title: "Jump ahead a few seasons",
  items: [
    "There's a new **Jump ahead** card on the Dashboard. Type a number of seasons, up to 25, and the game plays them all out with the AI running your club, then hands it back to you at the far end. It works mid-season too. It finishes the season you're in first, so asking for 1 always means \"get me to next year\".",
    "I added it because there was no way to find out what a world looks like in 2050 without personally managing every matchday between here and there, and because sometimes you inherit a rebuild you have no interest in sitting through.",
    "**Your club is genuinely an AI club while you're gone.** It picks its own formation and eleven, buys and sells, renews contracts, signs free agents and trims itself back to 25. Other clubs can bid for your players. Your best ones are protected the same way an AI club's are, which is by price rather than by refusing to talk, so a big enough offer takes them. If you go down, your best players can get pulled back up to the first division like anyone else's. You're not leaving instructions for a caretaker, you're handing the club over.",
    "- Your **saved starting XI, transfer listings and any open talks are cleared** when you hand over. There's nobody there to finish a negotiation, and an eleven you picked six seasons ago isn't a team sheet any more.\n- Potential comes back **fogged** for anyone signed while you were away, and stays sharp for the players you already knew. You haven't watched the new arrivals, so the game doesn't pretend you have.\n- When you get back there's a **summary of every season** the AI played: where you finished, on how many points, and any titles, promotions, relegations or cup runs along the way.\n- **There's no undo.** The only route back to the season you left is a save you exported before you jumped, which is why the button asks you to confirm.",
    "It takes a while to actually play, roughly 20 seconds a season, so a 15-season jump is a few minutes of watching a progress bar. Every match in every league really is played, so the world you land in is the same one you'd have got by clicking through it all yourself.",
  ],
};

export default entry;
