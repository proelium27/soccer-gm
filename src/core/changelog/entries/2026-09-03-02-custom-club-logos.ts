import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-09-03",
  title: "Bring your own club badges",
  items: [
    "There's a **Load club logos** button on the New League screen, under the roster loader. Point it at a folder of picture files named after the clubs and each one turns up wherever that club does: the table, the transfer list, the news feed, everywhere. PNG, JPG, WebP, GIF and SVG all work. This is the thing people have asked for most since real rosters went in, because importing Liverpool and then watching them play out the season as a green rectangle is a bit of a letdown.",
    "Badges are matched **by club name**, not by which slot they're in. `Liverpool.png` finds Liverpool. Capitals, accents, dashes and underscores all get ignored, so `bayern-munchen.png` finds Bayern München and `real_sociedad.webp` finds Real Sociedad. A trailing \"logo\" or \"crest\" in the filename gets stripped too, since that's what half the badges you download are called.",
    "**Load your roster file first.** Names are how the matching works, so the clubs have to already be called what you think they're called. If you do it the other way round the badges go looking for Liverpool in a world that hasn't got one yet and nothing lands.",
    "When something doesn't match, the screen names it. That mattered more than it sounds: a badge that lands on nobody looks exactly the same as no badge at all, so without that you'd just have a club that's mysteriously still a rectangle and no idea why.",
    "Every picture gets shrunk to 160 pixels square as it loads. Real club badges are often 100KB or more each, and a full 626 club world of those would be about 70MB of images going into a save that then has to be written to disk every time you change your lineup. At 160 square the whole world costs a few MB and it's stored off to one side, so the rest of the game doesn't pay for it.",
    "Your badges travel with the save when you export it, and a `.json` logo pack somebody else made loads in the same picker, so you can hand a set around.",
    "The one real limitation: you can only load logos when you're creating a league, same as roster files. If you've got a save going with real clubs in it already, there's no way to add badges to it yet. That's the next thing to fix and it's not a hard one, it just isn't done.",
  ],
};

export default entry;
