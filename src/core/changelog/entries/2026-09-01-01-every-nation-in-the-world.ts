import type { ChangelogEntry } from "../types.js";

const entry: ChangelogEntry = {
  date: "2026-09-01",
  title: "Every nation in the world",
  items: [
    "The nationalities panel in World setup used to offer 108 countries. It now offers all 211, which is every country that plays international football. Taiwan, Latvia, Haiti, Nepal, Rwanda, Samoa, the lot.",
    "The 108 were never a considered list. They were whichever nations happened to turn up in one of the twelve shipped leagues' real squad breakdowns, which is a fine reason for a rest-of-the-world tail and a bad reason for a menu. If you wanted to build a Taiwanese league, the game had no Taiwanese names to give it and quietly ignored you.",
    "Each of the new 101 gets a pool of its own: 56 first names and 56 surnames, so about three thousand combinations each. They're ordinary civilian names, never real footballers'.",
    "25 of them got flag art too, including Estonia, Latvia, Lithuania, Luxembourg, Armenia, Taiwan, Palestine and Myanmar. The rest show a plain swatch, same as before. Their flags need Arabic calligraphy, a coat of arms or a dragon, and I'd rather show you nothing than show you a wrong flag.",
    "Your existing saves generate exactly the same players they did before. The new nations only ever appear in a league whose mix names them, so they can't leak into anyone's rest-of-the-world tail. I checked that rather than assumed it: 390,000 draws across every league, zero differences.",
    "Name a league's players and that country becomes a real international side. So build a Taiwanese league and Taiwan starts turning up in Asian qualifying, and you can manage them.",
  ],
};

export default entry;
